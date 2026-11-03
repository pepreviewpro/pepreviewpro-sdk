import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, replayFetch } from "../../../test/replay";
import { DEFAULT_BASE_URL, PepReviewProClient, type OrdersRequest } from "../src";

const created = fixtureCase("orders", "a string id gets a surrogate and its completed order queues the campaign");
const ordersBody = created.request.body as OrdersRequest;
const sleep = async () => {};

describe("requests", () => {
	it("sends the recorded orders body to the recorded path with the key", async () => {
		const { fetch, requests } = replayFetch(created);
		const response = await new PepReviewProClient({ apiKey: fakeKey(), fetch }).orders(ordersBody);
		expect(response).toEqual(created.response.body);
		const [request] = requests;
		expect(request?.method).toBe("POST");
		expect(request?.url.toString()).toBe(`${DEFAULT_BASE_URL}${created.path}`);
		expect(request?.headers.get("authorization")).toBe(`Bearer ${fakeKey()}`);
		expect(request?.headers.get("content-type")).toBe("application/json");
		expect(request?.body).toEqual(created.request.body);
	});

	it("generates one Idempotency-Key per call and keeps it across retries", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("my-stores", "over the rate limit"), created, created);
		const client = new PepReviewProClient({ apiKey: fakeKey(), fetch, sleep });
		await client.orders(ordersBody);
		await client.orders(ordersBody);
		const keys = requests.map((request) => request.headers.get("idempotency-key"));
		expect(keys[0]).toMatch(/^prp_[0-9a-f-]{36}$/);
		expect(keys[1]).toBe(keys[0]);
		expect(keys[2]).not.toBe(keys[0]);
	});

	it("uses the caller's Idempotency-Key when given", async () => {
		const { fetch, requests } = replayFetch(created);
		await new PepReviewProClient({ apiKey: fakeKey(), fetch }).orders(ordersBody, { idempotencyKey: "checkout-ORD-1001" });
		expect(requests[0]?.headers.get("idempotency-key")).toBe("checkout-ORD-1001");
	});

	it("sends no key, user agent, or content type on public reads, so browsers skip the preflight", async () => {
		const recorded = fixtureCase("widget-data-product-ref", "one product by the store's own id");
		const { fetch, requests } = replayFetch(recorded);
		const client = new PepReviewProClient({ apiKey: fakeKey(), userAgent: "pepreviewpro-sdk/test", fetch });
		await expect(client.widgetData({ site_id: "magnolia-store", product_ref: "sku-101", limit: 20 })).resolves.toEqual(recorded.response.body);
		const [request] = requests;
		expect(request?.url.search).toBe(`?${recorded.request.query}`);
		expect([...(request?.headers.keys() ?? [])]).toEqual(["accept"]);
	});

	it("sends the user agent on keyed requests", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("heartbeat", "records the install, dropping capabilities it does not know"));
		await new PepReviewProClient({ apiKey: fakeKey(), userAgent: "pepreviewpro-sdk/test", fetch }).heartbeat({} as never);
		expect(requests[0]?.headers.get("user-agent")).toBe("pepreviewpro-sdk/test");
	});

	it("builds the query from set params only and honours a custom base URL", async () => {
		const page = fixtureCase("my-reviews", "changes since a time, oldest change first, two at a time");
		const { fetch, requests } = replayFetch(page);
		const client = new PepReviewProClient({ apiKey: fakeKey(), fetch, baseUrl: "https://staging.pepreviewpro.com/" });
		const response = await client.myReviews({ store: "example-store", updated_since: "2026-09-01T00:00:00Z", limit: 2 });
		expect(`${requests[0]?.url.origin}${requests[0]?.url.pathname}`).toBe(`https://staging.pepreviewpro.com${page.path}`);
		expect(Object.fromEntries(requests[0]!.url.searchParams)).toEqual(Object.fromEntries(new URLSearchParams(page.request.query)));
		expect(response.next_cursor).toEqual(expect.any(String));
	});

	it("reads the stores a key reaches", async () => {
		const recorded = fixtureCase("my-stores", "one store by slug");
		const { fetch, requests } = replayFetch(recorded);
		await expect(new PepReviewProClient({ apiKey: fakeKey(), fetch }).myStores({ store: "example-store" })).resolves.toEqual(recorded.response.body);
		expect(requests[0]?.url.search).toBe(`?${recorded.request.query}`);
	});

	it("puts the catalog with an Idempotency-Key", async () => {
		const recorded = fixtureCase("catalog", "saves the catalog, skipping what does not parse");
		const { fetch, requests } = replayFetch(recorded);
		await expect(new PepReviewProClient({ apiKey: fakeKey(), fetch }).catalog(recorded.request.body as never)).resolves.toEqual(recorded.response.body);
		expect(requests[0]).toMatchObject({ method: "PUT", body: recorded.request.body });
		expect(requests[0]?.headers.get("idempotency-key")).toMatch(/^prp_/);
	});
});

describe("ids", () => {
	const client = new PepReviewProClient({ apiKey: fakeKey(), fetch: replayFetch(created).fetch });

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, "", "   ", "x".repeat(201)])("refuses %j before sending", (id) => {
		expect(() => client.orders({ store: "example-store", orders: [{ id: id as never, status: "paid" }] })).toThrow(TypeError);
	});

	it("refuses a bad product id inside a line item", () => {
		expect(() => client.orders({ store: "s", orders: [{ id: "ORD-1", status: "paid", line_items: [{ product_id: 0 }] }] })).toThrow(
			/line_items\[0\]\.product_id/
		);
	});

	it.each(["", "k".repeat(201)])("refuses an Idempotency-Key of %j", (idempotencyKey) => {
		expect(() => client.orders({ store: "s", orders: [{ id: 1, status: "paid" }] }, { idempotencyKey })).toThrow(RangeError);
	});

	it("refuses an empty batch and one over 200", () => {
		expect(() => client.orders({ store: "s", orders: [] })).toThrow(RangeError);
		expect(() =>
			client.orders({ store: "s", orders: Array.from({ length: 201 }, (_, index) => ({ id: index + 1, status: "paid" as const })) })
		).toThrow(RangeError);
	});

	it("refuses more than 5,000 products", () => {
		expect(() => client.catalog({ store: "s", products: Array.from({ length: 5001 }, (_, index) => ({ id: index + 1, name: "x" })) })).toThrow(
			RangeError
		);
	});
});
