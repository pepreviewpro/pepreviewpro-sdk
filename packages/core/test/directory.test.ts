import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch } from "../../../test/replay";
import { API_ERRORS, DEFAULT_BASE_URL, PepReviewProClient, type ClientOptions, type PartnerEventsRequest } from "../src";

const withCompound = fixtureCase("stores", "stores with a product for the compound");
const products = fixtureCase("products", "products for a compound, best first");
const reviews = fixtureCase("reviews", "one store with a minimum rating");
const missed = fixtureCase("vendor-miss", "a store that is not on PepReviewPro");
const shown = fixtureCase("partner-events", "shown stores and a click are recorded, an unknown store and a bad type are skipped");
const rateLimited = fixtureCase("my-stores", "over the rate limit");
const internalError = { error: { code: "internal_error", message: API_ERRORS.internal, request_id: "req_1" } };

function client(fetchImpl: typeof fetch, options: ClientOptions = {}) {
	return new PepReviewProClient({ apiKey: fakeKey("pk"), fetch: fetchImpl, sleep: async () => {}, ...options });
}

/** A failed connection the way Node's `fetch` reports it: a TypeError whose cause carries the socket's code. */
function connectionError(code: string): TypeError {
	return new TypeError("fetch failed", { cause: Object.assign(new Error(`connect ${code}`), { code }) });
}

describe("directory reads", () => {
	it("sends the recorded stores query with the key and returns the body as recorded", async () => {
		const { fetch, requests } = replayFetch(withCompound);
		await expect(client(fetch).stores({ compound: "bpc-157", sort: "best", limit: 3 })).resolves.toEqual(withCompound.response.body);
		expect(requests[0]?.url.toString()).toBe(`${DEFAULT_BASE_URL}${withCompound.path}?${withCompound.request.query}`);
		expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${fakeKey("pk")}`);
	});

	it("reads products, directory reviews, and the key", async () => {
		const me = fixtureCase("me", "X-Api-Key works when there is no bearer token");
		const { fetch, requests } = replayFetch(products, reviews, me);
		const instance = client(fetch);
		await expect(instance.products({ compound: "bpc-157", sort: "best", limit: 50 })).resolves.toEqual(products.response.body);
		await expect(instance.reviews({ store: "olive-store", min_rating: 5 })).resolves.toEqual(reviews.response.body);
		await expect(instance.me()).resolves.toEqual(me.response.body);
		expect(requests.map((request) => `${request.url.pathname}${request.url.search}`)).toEqual([
			`${products.path}?${products.request.query}`,
			`${reviews.path}?${reviews.request.query}`,
			"/api/v1/me"
		]);
	});

	it("retries a read after a 5xx", async () => {
		const { fetch, requests } = replayFetch(jsonResponse(503, internalError), withCompound);
		await expect(client(fetch).stores({ compound: "bpc-157" })).resolves.toEqual(withCompound.response.body);
		expect(requests).toHaveLength(2);
	});

	it("reads the error's code and message", async () => {
		const { fetch } = replayFetch(fixtureCase("products", "no compound"));
		await expect(client(fetch, { maxRetries: 0 }).products({ compound: "" })).rejects.toMatchObject({
			status: 400,
			code: "missing_compound",
			message: API_ERRORS.compoundRequired
		});
	});

	it("pages with the cursor the last page sent", async () => {
		const first = fixtureCase("reviews", "two at a time, with a cursor to the next");
		const next = fixtureCase("reviews", "the next two from the cursor");
		const { fetch, requests } = replayFetch(first, next);
		const instance = client(fetch);
		const page = await instance.reviews({ limit: 2 });
		await instance.reviews({ limit: 2, cursor: page.next_cursor ?? "" });
		expect(requests.map((request) => request.url.search)).toEqual([`?${first.request.query}`, `?${next.request.query}`]);
	});
});

describe("counted writes", () => {
	const events = shown.request.body as PartnerEventsRequest;

	it("posts a vendor miss and partner events as recorded", async () => {
		const { fetch, requests } = replayFetch(missed, shown);
		const instance = client(fetch);
		await expect(instance.vendorMiss(missed.request.body as never)).resolves.toEqual(missed.response.body);
		await expect(instance.partnerEvents(events)).resolves.toEqual(shown.response.body);
		expect(requests.map((request) => [request.method, request.url.pathname, request.body])).toEqual([
			["POST", "/api/v1/vendor-miss", missed.request.body],
			["POST", "/api/v1/partner-events", events]
		]);
	});

	it("sends one Idempotency-Key per call and repeats it on each retry, so a 5xx or a dropped connection is retried", async () => {
		const flaky = replayFetch(jsonResponse(500, internalError), connectionError("ECONNRESET"), shown);
		await expect(client(flaky.fetch).partnerEvents(events)).resolves.toEqual(shown.response.body);
		const keys = flaky.requests.map((request) => request.headers.get("idempotency-key"));
		expect(keys).toHaveLength(3);
		expect(keys[0]).toMatch(/.+/);
		expect(new Set(keys).size).toBe(1);
		const { fetch, requests } = replayFetch(missed, missed);
		const instance = client(fetch);
		await instance.vendorMiss({ name: "Juniper Store" });
		await instance.vendorMiss({ name: "Juniper Store" }, { idempotencyKey: "miss-0001" });
		const [generated, given] = requests.map((request) => request.headers.get("idempotency-key"));
		expect(generated).not.toBe(keys[0]);
		expect(given).toBe("miss-0001");
	});

	it("gives each event without an id one, and keeps it across retries", async () => {
		const { fetch, requests } = replayFetch(jsonResponse(500, internalError), shown);
		await client(fetch).partnerEvents({
			events: [
				{ id: "evt-1", type: "shown", store: "example-store" },
				{ type: "click", store: "olive-store" }
			]
		});
		const sent = requests.map((request) => (request.body as PartnerEventsRequest).events.map((event) => event.id));
		expect(sent[0]?.[0]).toBe("evt-1");
		expect(sent[0]?.[1]).toMatch(/^prp_/);
		expect(sent[1]).toEqual(sent[0]);
	});

	it("refuses an Idempotency-Key over 200 characters before sending", () => {
		const { fetch, requests } = replayFetch(missed);
		expect(() => client(fetch).vendorMiss({ name: "Juniper Store" }, { idempotencyKey: "k".repeat(201) })).toThrow(RangeError);
		expect(requests).toHaveLength(0);
	});

	it("retries a 429 and a connection that never opened", async () => {
		const limited = replayFetch(rateLimited, shown);
		await expect(client(limited.fetch).partnerEvents(events)).resolves.toMatchObject({ recorded: 3 });
		expect(limited.requests).toHaveLength(2);
		const refused = replayFetch(connectionError("ECONNREFUSED"), missed);
		await expect(client(refused.fetch).vendorMiss({ name: "Juniper Store" })).resolves.toMatchObject({ in_directory: false });
		expect(refused.requests).toHaveLength(2);
		const unresolved = replayFetch(
			new TypeError("fetch failed", { cause: new AggregateError([connectionError("ENOTFOUND").cause, connectionError("EAI_AGAIN").cause]) }),
			missed
		);
		await expect(client(unresolved.fetch).vendorMiss({ name: "Juniper Store" })).resolves.toEqual(missed.response.body);
	});

	it("refuses more than 50 events before sending", () => {
		const { fetch, requests } = replayFetch(shown);
		expect(() =>
			client(fetch).partnerEvents({ events: Array.from({ length: 51 }, () => ({ type: "shown" as const, store: "example-store" })) })
		).toThrow(RangeError);
		expect(requests).toHaveLength(0);
	});
});
