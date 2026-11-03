import { describe, expect, it, vi } from "vitest";
import { fakeKey, fixtureCase, replayFetch } from "../../../test/replay";
import { PepReviewPro } from "../src";

const byRef = fixtureCase("widget-data-product-ref", "one product by the store's own id");
const firstPage = fixtureCase("my-reviews", "one store, four at a time");
const lastPage = fixtureCase("my-reviews", "the next four from the cursor");
const changed = fixtureCase("my-reviews", "changes since a time, oldest change first, two at a time");

function sdk(fetchImpl: typeof fetch, apiKey: string | undefined = fakeKey(), store = "magnolia-store") {
	return new PepReviewPro({ store, apiKey, fetch: fetchImpl, heartbeat: false });
}

describe("catalog.push", () => {
	it("sends the recorded catalog body in the API's names", async () => {
		const recorded = fixtureCase("catalog", "saves the catalog, skipping what does not parse");
		const body = recorded.request.body as { store: string; products: Record<string, unknown>[]; ships_to: string[] };
		const { fetch, requests } = replayFetch(recorded);
		const first = body.products[0]!;
		const result = await sdk(fetch, fakeKey(), body.store).catalog.push({
			products: [
				{
					id: first["id"] as string,
					name: first["name"] as string,
					shortDescription: first["short_description"] as string,
					url: first["url"] as string,
					imageUrl: first["image_url"] as string,
					priceMin: first["price_min"] as number,
					priceMax: first["price_max"] as null,
					currency: first["currency"] as string,
					inStock: first["in_stock"] as boolean
				}
			],
			shipsTo: body.ships_to,
			shipsFrom: "US",
			paymentMethods: ["card", "crypto"]
		});
		expect(result).toEqual({ products: 2, mapped: 0, skipped: 1 });
		expect(requests[0]).toMatchObject({ method: "PUT", body: { ...body, products: [body.products[0]] } });
	});

	it("leaves shipping and payment out when not given, so they stay as they are", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("catalog", "saves the catalog, skipping what does not parse"));
		await sdk(fetch).catalog.push({ products: [] });
		expect(requests[0]?.body).toEqual({ store: "magnolia-store", products: [] });
	});
});

describe("reviews.list", () => {
	it("reads public widget-data by the store's own product id, without the key", async () => {
		const { fetch, requests } = replayFetch(byRef);
		const list = await sdk(fetch).reviews.list({ productRef: "sku-101", limit: 20 });
		const body = byRef.response.body as Record<string, unknown>;
		expect(list).toEqual({ store: body["store"], settings: body["settings"], reviews: body["reviews"], aggregate: body["aggregate"] });
		expect(requests[0]?.url.pathname).toBe("/api/v1/widget-data");
		expect(requests[0]?.url.search).toBe(`?${byRef.request.query}`);
		expect(requests[0]?.headers.get("authorization")).toBeNull();
	});

	it("sends an integer id as the frozen product_id", async () => {
		const recorded = fixtureCase("get-widget-data", "by uuid, one product, limited");
		const { fetch, requests } = replayFetch(recorded);
		await sdk(fetch).reviews.list({ productRef: "88", limit: 1 });
		expect(requests[0]?.url.search).toBe("?site_id=magnolia-store&product_id=88&limit=1");
	});

	it("works with no key at all", async () => {
		const { fetch } = replayFetch(fixtureCase("get-widget-data", "by slug, with the store's minimum rating applied"));
		vi.stubEnv("PEPREVIEWPRO_API_KEY", "");
		await expect(sdk(fetch, undefined).reviews.list()).resolves.toHaveProperty("aggregate.total", 5);
	});
});

describe("reviews.sync", () => {
	it("pages my-reviews by cursor", async () => {
		const { fetch, requests } = replayFetch(firstPage, lastPage);
		const client = sdk(fetch, fakeKey(), "example-store");
		const first = await client.reviews.sync({ limit: 4 });
		expect(first).toEqual({
			reviews: (firstPage.response.body as { reviews: unknown[] }).reviews,
			nextCursor: "eyJvIjo0fQ",
			aggregate: (firstPage.response.body as { aggregate: unknown }).aggregate
		});
		const last = await client.reviews.sync({ cursor: first.nextCursor, limit: 4 });
		expect(last.nextCursor).toBeNull();
		expect(requests.map((request) => request.url.search)).toEqual([`?${firstPage.request.query}`, `?${lastPage.request.query}`]);
		expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${fakeKey()}`);
	});

	it("sends updatedSince as given and reads the new review shape", async () => {
		const { fetch, requests } = replayFetch(changed);
		const page = await sdk(fetch, fakeKey(), "example-store").reviews.sync({ updatedSince: "2026-09-01T00:00:00Z", limit: 2 });
		expect(Object.fromEntries(requests[0]!.url.searchParams)).toEqual(Object.fromEntries(new URLSearchParams(changed.request.query)));
		expect(page.reviews[0]).toMatchObject({ store: "example-store", author: expect.any(String), verified: expect.any(Boolean) });
		expect(page.reviews[0]?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});
});

describe("reviews.syncAll", () => {
	it("yields every review across the pages", async () => {
		const { fetch, requests } = replayFetch(firstPage, lastPage);
		const ids: string[] = [];
		for await (const review of sdk(fetch, fakeKey(), "example-store").reviews.syncAll({ limit: 4 })) {
			ids.push(review.id);
		}

		expect(ids).toHaveLength(5);
		expect(requests).toHaveLength(2);
	});
});

describe("me", () => {
	it("reads the key's type, scopes, and quota, which a store key does not have", async () => {
		const recorded = fixtureCase("me", "an old-system key reads itself and this month's usage");
		const info = await sdk(replayFetch(recorded).fetch).me();
		const body = recorded.response.body as { key: { scopes: string[] }; limits: { monthly_quota: number | null } };
		expect(info.key.scopes).toEqual(body.key.scopes);
		expect(info.limits.monthlyQuota).toBe(body.limits.monthly_quota);
	});
});

describe("jsonLd.product", () => {
	it("fetches the product's reviews and marks up what the widget shows", async () => {
		const { fetch, requests } = replayFetch(byRef);
		const markup = await sdk(fetch).jsonLd.product({ name: "BPC-157 10mg", url: "https://store.example/p/bpc-157-10mg", productRef: "sku-101" });
		expect(requests[0]?.url.search).toBe("?site_id=magnolia-store&product_ref=sku-101&limit=20");
		expect(markup?.aggregateRating?.ratingValue).toBe(3.86);
		expect(markup?.review?.every((review) => review.reviewRating.ratingValue >= 3)).toBe(true);
	});

	it("reuses data already fetched for the page", async () => {
		const { fetch, requests } = replayFetch(byRef);
		const client = sdk(fetch);
		const data = await client.reviews.list({ productRef: "sku-101", limit: 20 });
		await client.jsonLd.product({ name: "BPC-157 10mg", url: "https://store.example/p/bpc-157-10mg", data });
		expect(requests).toHaveLength(1);
	});
});

describe("construction", () => {
	it("reads the key from PEPREVIEWPRO_API_KEY", async () => {
		vi.stubEnv("PEPREVIEWPRO_API_KEY", fakeKey("sk", "b"));
		const { fetch, requests } = replayFetch(firstPage);
		await new PepReviewPro({ store: "example-store", fetch, heartbeat: false }).reviews.sync();
		expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${fakeKey("sk", "b")}`);
		expect(requests[0]?.headers.get("user-agent")).toMatch(/^pepreviewpro-sdk\/0\.0\.0-test \(node@/);
	});

	it("wants the store's slug, not its id", () => {
		expect(() => new PepReviewPro({ store: " " })).toThrow(/slug/);
		expect(() => new PepReviewPro({ store: "00000000-0000-4000-8000-000000000003" })).toThrow(/not its id/);
	});
});
