import type { ApiProduct, ApiReview, ApiStore, DirectoryReviewsResponse, ProductsResponse, StoresResponse } from "@pepreviewpro/core";
import { describe, expect, it, vi } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch } from "../../../test/replay";
import { API_ERRORS, PepReviewProApiError, PepReviewProPartner, type DirectoryEvent } from "../src";

const withCompound = fixtureCase("stores", "stores with a product for the compound");
const directory = fixtureCase("stores", "the directory, best first");
const products = fixtureCase("products", "products for a compound, best first");
const reviews = fixtureCase("reviews", "one store with a minimum rating");
const missed = fixtureCase("vendor-miss", "a store that is not on PepReviewPro");
const shown = fixtureCase("partner-events", "shown stores and a click are recorded, an unknown store and a bad type are skipped");
const recordedStores = (withCompound.response.body as StoresResponse).stores;

function partner(fetchImpl: typeof fetch, waitUntil?: (promise: Promise<unknown>) => void) {
	return new PepReviewProPartner({ apiKey: fakeKey("pk"), fetch: fetchImpl, waitUntil });
}

const toProduct = (product: ApiProduct) => ({
	ref: product.ref,
	name: product.name,
	imageUrl: product.image_url,
	priceMin: product.price_min,
	priceMax: product.price_max,
	currency: product.currency,
	inStock: product.in_stock,
	reviewCount: product.review_count,
	clickUrl: product.click_url,
	pageUrl: product.page_url,
	store: { slug: product.store.slug, name: product.store.name, websiteUrl: product.store.website_url }
});

describe("stores.list", () => {
	it("maps every recorded field to the camelCase DTO, with the tracked links as the obvious ones", async () => {
		const { fetch, requests } = replayFetch(withCompound);
		const page = await partner(fetch).stores.list({ compound: "bpc-157", sort: "best", limit: 3 });
		expect(requests[0]?.url.search).toBe(`?${withCompound.request.query}`);
		const [first] = recordedStores as [ApiStore];
		expect(page.stores[0]).toEqual({
			slug: first.slug,
			name: first.name,
			websiteUrl: first.website_url,
			description: first.description,
			rating: first.rating,
			score: first.score,
			reviewCount: first.review_count,
			verifiedReviewCount: first.verified_review_count,
			clickUrl: first.click_url,
			profileUrl: first.profile_url,
			logoUrl: first.logo_url,
			accentColor: first.accent_color,
			shipsFrom: first.ships_from,
			shipsTo: first.ships_to,
			paymentMethods: first.payment_methods,
			coaUrl: first.coa_url,
			catalogSyncedAt: first.catalog_synced_at,
			matchedProducts: first.matched_products!.map(toProduct),
			matchedProductCount: first.matched_product_count
		});
		expect(page).toEqual({
			stores: expect.any(Array),
			total: 2,
			nextCursor: null,
			unknownCompound: false,
			filters: { compound: { slug: "bpc-157", name: "BPC-157" }, unknownCompound: false, shipsTo: null, payment: null, inStock: false, minRating: null }
		});
	});

	it("sends the filters in the API's names and leaves matchedProducts off without a compound", async () => {
		const { fetch, requests } = replayFetch(directory);
		const page = await partner(fetch).stores.list({
			shipsTo: "ca",
			payment: "card",
			inStock: true,
			minRating: 4,
			search: "Olive",
			cursor: "eyJvIjoxfQ"
		});
		expect(Object.fromEntries(requests[0]!.url.searchParams)).toEqual({
			ships_to: "CA",
			payment: "card",
			in_stock: "true",
			min_rating: "4",
			search: "Olive",
			cursor: "eyJvIjoxfQ"
		});
		expect(page.stores.every((store) => !("matchedProducts" in store))).toBe(true);
		expect(page.unknownCompound).toBe(false);
	});

	it("says when the API does not know the compound, and reads the filters as it applied them", async () => {
		const unknown = await partner(replayFetch(fixtureCase("stores", "a compound outside the library matches nothing")).fetch).stores.list({
			compound: "unknown",
			sort: "best",
			limit: 3
		});
		expect(unknown).toMatchObject({ stores: [], unknownCompound: true, filters: { compound: null, unknownCompound: true } });
		const echoed = fixtureCase("stores", "the filters applied are echoed, the compound as the library names it");
		const page = await partner(replayFetch(echoed).fetch).stores.list({
			compound: "BPC-157",
			shipsTo: "us",
			payment: "crypto",
			inStock: true,
			minRating: 1
		});
		expect(page.filters).toEqual({
			compound: { slug: "bpc-157", name: "BPC-157" },
			unknownCompound: false,
			shipsTo: "US",
			payment: "crypto",
			inStock: true,
			minRating: 1
		});
	});

	it("has no click links on a key no partner is linked to", async () => {
		const page = await partner(replayFetch(fixtureCase("stores", "a key no partner is linked to gets no click_url")).fetch).stores.list({
			compound: "tb-500"
		});
		expect(page.stores[0]).toMatchObject({ clickUrl: null, profileUrl: expect.stringContaining("/vendors/") });
		expect(page.stores[0]?.matchedProducts?.every((product) => product.clickUrl === null)).toBe(true);
	});

	it("throws the API's own error", async () => {
		const { fetch } = replayFetch(fixtureCase("stores", "a country that is not a code"));
		const error = await partner(fetch)
			.stores.list({ shipsTo: "UK" })
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(PepReviewProApiError);
		expect(error).toMatchObject({ status: 400, code: "invalid_ships_to", message: API_ERRORS.invalidShipsTo });
	});
});

describe("stores.iterate", () => {
	it("follows next_cursor until it is null, sending the same filters each time", async () => {
		const [first, second] = recordedStores as [ApiStore, ApiStore];
		const body = withCompound.response.body as StoresResponse;
		const { fetch, requests } = replayFetch(
			jsonResponse(200, { ...body, stores: [first], next_cursor: "eyJvIjoxfQ" }),
			jsonResponse(200, { ...body, stores: [second], next_cursor: null })
		);
		const slugs: string[] = [];
		for await (const store of partner(fetch).stores.iterate({ compound: "bpc-157", limit: 1 })) {
			slugs.push(store.slug);
		}

		expect(slugs).toEqual([first.slug, second.slug]);
		expect(requests.map((request) => request.url.search)).toEqual(["?compound=bpc-157&limit=1", "?compound=bpc-157&limit=1&cursor=eyJvIjoxfQ"]);
	});

	it("fetches no further than the loop reads", async () => {
		const body = withCompound.response.body as StoresResponse;
		const { fetch, requests } = replayFetch(jsonResponse(200, { ...body, next_cursor: "eyJvIjoyfQ" }));
		for await (const store of partner(fetch).stores.iterate()) {
			expect(store.slug).toBeTruthy();
			break;
		}

		expect(requests).toHaveLength(1);
	});
});

describe("products.list", () => {
	it("maps each product and its slim store, with the store's website", async () => {
		const { fetch, requests } = replayFetch(products);
		const recorded = (products.response.body as ProductsResponse).products;
		const page = await partner(fetch).products.list({ compound: "bpc-157", sort: "best", limit: 50 });
		expect(requests[0]?.url.search).toBe(`?${products.request.query}`);
		expect(page.products).toEqual(recorded.map(toProduct));
		expect(page).toMatchObject({ total: 5, nextCursor: null, unknownCompound: false });
	});

	it("sends the store slugs to the API, which filters before paging", async () => {
		const several = fixtureCase("products", "several stores, filtered before paging");
		const { fetch, requests } = replayFetch(several);
		const page = await partner(fetch).products.list({
			compound: "bpc-157",
			stores: ["example-store", "olive-store"],
			sort: "price",
			limit: 2,
			cursor: "eyJvIjoxfQ"
		});
		expect(requests[0]?.url.searchParams.get("store")).toBe("example-store,olive-store");
		const recorded = several.response.body as ProductsResponse;
		expect(page.products.map((product) => product.store.slug)).toEqual(recorded.products.map((product) => product.store.slug));
		expect(page).toMatchObject({ total: recorded.total, nextCursor: recorded.next_cursor });
	});
});

describe("reviews", () => {
	it("maps the directory feed", async () => {
		const { fetch, requests } = replayFetch(reviews);
		const [review] = (reviews.response.body as DirectoryReviewsResponse).reviews as [ApiReview];
		const page = await partner(fetch).reviews.list({ store: "olive-store", minRating: 5 });
		expect(requests[0]?.url.search).toBe(`?${reviews.request.query}`);
		expect(page).toEqual({
			reviews: [
				{
					id: review.id,
					store: review.store,
					productRef: review.product_ref,
					rating: review.rating,
					title: review.title,
					body: review.body,
					author: review.author,
					verified: review.verified,
					createdAt: review.created_at,
					updatedAt: review.updated_at
				}
			],
			nextCursor: null
		});
	});

	it("iterates page after page with the recorded cursors", async () => {
		const first = fixtureCase("reviews", "two at a time, with a cursor to the next");
		const next = fixtureCase("reviews", "the next two from the cursor");
		const { fetch, requests } = replayFetch(first, next, jsonResponse(200, { reviews: [], next_cursor: null }));
		const ids: string[] = [];
		for await (const review of partner(fetch).reviews.iterate({ limit: 2 })) {
			ids.push(review.id);
		}

		expect(ids).toHaveLength(4);
		expect(requests.slice(0, 2).map((request) => request.url.search)).toEqual([`?${first.request.query}`, `?${next.request.query}`]);
		expect(requests).toHaveLength(3);
	});
});

describe("vendorMiss.report", () => {
	it("trims and cuts the name and question to what the API takes", async () => {
		const { fetch, requests } = replayFetch(missed);
		const outcome = await partner(fetch).vendorMiss.report({
			name: `  ${"Juniper Store ".repeat(20)}`,
			url: "https://juniper-store.example",
			question: `${"Where can I buy BPC-157? ".repeat(20)}`
		});
		expect(outcome).toEqual({ inDirectory: false, listedWithPartners: false });
		const sent = requests[0]?.body as { name: string; question: string; url: string };
		expect(sent.name).toHaveLength(120);
		expect(sent.name.startsWith("Juniper Store")).toBe(true);
		expect(sent.question).toHaveLength(200);
		expect(sent.url).toBe("https://juniper-store.example");
	});

	it("never cuts a character in half", async () => {
		const { fetch, requests } = replayFetch(missed);
		await partner(fetch).vendorMiss.report({ name: `${"x".repeat(119)}🙂` });
		expect((requests[0]?.body as { name: string }).name).toBe("x".repeat(119));
	});

	it("refuses a blank name before sending", async () => {
		const { fetch, requests } = replayFetch(missed);
		await expect(partner(fetch).vendorMiss.report({ name: "   " })).rejects.toThrow(TypeError);
		expect(requests).toHaveLength(0);
	});

	it("in the background, hands the send to waitUntil and reports a failure without throwing", async () => {
		const waited: Promise<unknown>[] = [];
		const onError = vi.fn();
		const { fetch } = replayFetch(jsonResponse(500, { error: { code: "internal_error", message: API_ERRORS.internal, request_id: "req_1" } }));
		expect(
			partner(fetch, (promise) => waited.push(promise)).vendorMiss.report({ name: "Juniper Store" }, { background: true, onError })
		).toBeUndefined();
		await Promise.all(waited);
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
	});
});

describe("events.report", () => {
	const events: DirectoryEvent[] = Array.from({ length: 120 }, (_, index) => ({
		type: "shown",
		store: index % 2 ? "olive-store" : "example-store",
		compound: "bpc-157",
		placement: "finderStore"
	}));

	it("sends batches of 50 in the API's names, an id on every event, and adds up the outcome", async () => {
		const { fetch, requests } = replayFetch(shown);
		await expect(partner(fetch).events.report(events)).resolves.toEqual({ recorded: 9, duplicates: 0, skipped: 6 });
		expect(requests.map((request) => (request.body as { events: unknown[] }).events.length)).toEqual([50, 50, 20]);
		expect((requests[0]?.body as { events: unknown[] }).events[0]).toEqual({
			id: expect.stringMatching(/^prp_/),
			type: "shown",
			store: "example-store",
			compound: "bpc-157",
			placement: "finderStore"
		});
	});

	it("sends your own event ids and product refs, and reports duplicates", async () => {
		const twice = fixtureCase("partner-events", "an id sent twice in one call counts once");
		const { fetch, requests } = replayFetch(twice);
		const outcome = await partner(fetch).events.report([
			{ id: "msg-1:example-store", type: "click", store: "example-store", productRef: "88", placement: "finderProduct" }
		]);
		expect(outcome).toEqual({ recorded: 2, duplicates: 1, skipped: 0 });
		expect((requests[0]?.body as { events: unknown[] }).events).toEqual([
			{ id: "msg-1:example-store", type: "click", store: "example-store", product_ref: "88", placement: "finderProduct" }
		]);
	});

	it("sends nothing for no events", async () => {
		const { fetch, requests } = replayFetch(shown);
		await expect(partner(fetch).events.report([])).resolves.toEqual({ recorded: 0, duplicates: 0, skipped: 0 });
		expect(requests).toHaveLength(0);
	});

	it("never throws in the background, even on a key with no partner", async () => {
		const waited: Promise<unknown>[] = [];
		const { fetch } = replayFetch(fixtureCase("partner-events", "a key with no partner"));
		const onError = vi.fn(() => {
			throw new Error("a logger that breaks");
		});
		partner(fetch, (promise) => waited.push(promise)).events.report(events, { background: true, onError });
		await expect(Promise.all(waited)).resolves.toEqual([undefined]);
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "not_partner_key", message: API_ERRORS.notPartnerKey }));
	});
});

describe("links.click", () => {
	const instance = partner(replayFetch(directory).fetch);
	const store = { clickUrl: "https://pepreviewpro.com/go/abc.def", websiteUrl: "https://www.store.example" };

	it("adds `to` when it is on the store's own site or a subdomain of it", () => {
		expect(instance.links.click(store, { to: "https://store.example/?ref=partner" })).toBe(
			"https://pepreviewpro.com/go/abc.def?to=https%3A%2F%2Fstore.example%2F%3Fref%3Dpartner"
		);
		expect(instance.links.click(store, { to: "https://shop.store.example/p/bpc-157" })).toContain("?to=");
	});

	it("leaves `to` off where /go/ would ignore it", () => {
		expect(instance.links.click(store)).toBe(store.clickUrl);
		expect(instance.links.click(store, { to: "https://other.example/?ref=partner" })).toBe(store.clickUrl);
		expect(instance.links.click(store, { to: "https://attacker.example/store.example" })).toBe(store.clickUrl);
		expect(instance.links.click(store, { to: "javascript:alert(1)" })).toBe(store.clickUrl);
		expect(instance.links.click({ clickUrl: store.clickUrl, websiteUrl: null }, { to: "https://store.example/" })).toBe(store.clickUrl);
	});

	it("checks a product's `to` against its store's website", () => {
		const product = { clickUrl: "https://pepreviewpro.com/go/xyz.uvw", store: { websiteUrl: "https://store.example" } };
		expect(instance.links.click(product, { to: "https://store.example/product/bpc-157-10mg?ref=partner" })).toContain("?to=");
	});

	it("is null when there is no tracked link", () => {
		expect(instance.links.click({ clickUrl: null, websiteUrl: "https://store.example" }, { to: "https://store.example/" })).toBeNull();
	});
});

describe("the client", () => {
	it("reads the key from the environment and names itself a partner", async () => {
		vi.stubEnv("PEPREVIEWPRO_API_KEY", fakeKey("pk", "b"));
		const me = fixtureCase("me", "X-Api-Key works when there is no bearer token");
		const { fetch, requests } = replayFetch(me);
		const info = await new PepReviewProPartner({ fetch }).me();
		expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${fakeKey("pk", "b")}`);
		expect(requests[0]?.headers.get("user-agent")).toMatch(/^pepreviewpro-sdk\/[\w.-]+ partner \(/);
		expect(info.key.scopes).toContain("partner:write");
		expect(info.limits).toEqual({ ratePerSecond: 20, monthlyQuota: 10_000, usedThisMonth: expect.any(Number), remainingThisMonth: expect.any(Number) });
	});
});
