import type { WidgetDataResponse } from "@pepreviewpro/core";
import { cacheLife, cacheTag, unstable_cache } from "next/cache";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeKey, fixtureCase, replayFetch } from "../../../test/replay";
import * as cacheComponents from "../src/entries/cache-components";
import { cacheTags, checkoutContext, getAggregate, getDirectoryProducts, getDirectoryStores, getReviews, ReviewsJsonLd } from "../src/index";

vi.mock("next/cache", () => ({
	unstable_cache: vi.fn((read: () => Promise<unknown>) => read),
	cacheTag: vi.fn(),
	cacheLife: vi.fn()
}));

const byRef = fixtureCase("widget-data-product-ref", "one product by the store's own id");
const body = byRef.response.body as WidgetDataResponse;

beforeEach(() => {
	vi.mocked(unstable_cache).mockClear();
	vi.stubEnv("PEPREVIEWPRO_STORE", "magnolia-store");
	vi.stubEnv("PEPREVIEWPRO_BASE_URL", "http://localhost:4010");
});

describe("getReviews", () => {
	it("reads public widget-data through unstable_cache, tagged for the store and the product, for an hour", async () => {
		const { fetch, requests } = replayFetch(byRef);
		vi.stubGlobal("fetch", fetch);
		await expect(getReviews({ productRef: "sku-101" })).resolves.toEqual({
			store: body.store,
			settings: body.settings,
			reviews: body.reviews,
			aggregate: body.aggregate
		});
		expect(requests[0]?.url.toString()).toBe(`http://localhost:4010${byRef.path}?${byRef.request.query}`);
		expect(vi.mocked(unstable_cache).mock.calls[0]?.slice(1)).toEqual([
			["pepreviewpro", "reviews", "magnolia-store", "sku-101", "20"],
			{ tags: ["pepreviewpro:magnolia-store", "pepreviewpro:magnolia-store:product:sku-101"], revalidate: 3600 }
		]);
		await expect(getAggregate({ productRef: "sku-101" })).resolves.toEqual(body.aggregate);
	});

	it("needs a store", () => {
		vi.stubEnv("PEPREVIEWPRO_STORE", "");
		expect(() => getReviews()).toThrow(/PEPREVIEWPRO_STORE/);
	});

	it("tags and times the 'use cache' reader the same way", async () => {
		vi.stubGlobal("fetch", replayFetch(byRef).fetch);
		await cacheComponents.getReviews({ store: "magnolia-store", productRef: "sku-101" });
		expect(cacheTag).toHaveBeenCalledWith("pepreviewpro:magnolia-store", "pepreviewpro:magnolia-store:product:sku-101");
		expect(cacheLife).toHaveBeenCalledWith("hours");
	});
});

describe("directory reads", () => {
	const withCompound = fixtureCase("stores", "stores with a product for the compound");

	it("read with the partner key through unstable_cache, keyed on the query and tagged for the directory", async () => {
		vi.stubEnv("PEPREVIEWPRO_API_KEY", fakeKey("pk"));
		const { fetch, requests } = replayFetch(withCompound, fixtureCase("products", "products for a compound, best first"));
		vi.stubGlobal("fetch", fetch);
		const page = await getDirectoryStores({ sort: "best", compound: "bpc-157", limit: 3 });
		expect(page.stores[0]?.clickUrl).toMatch(/^https:\/\/pepreviewpro\.com\/go\//);
		expect(requests[0]?.url.toString()).toBe(`http://localhost:4010${withCompound.path}?${withCompound.request.query}`);
		expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${fakeKey("pk")}`);
		expect(vi.mocked(unstable_cache).mock.calls[0]?.slice(1)).toEqual([
			[
				"pepreviewpro",
				"directory",
				"stores",
				JSON.stringify([
					["compound", "bpc-157"],
					["limit", 3],
					["sort", "best"]
				])
			],
			{ tags: ["pepreviewpro:directory"], revalidate: 300 }
		]);
		await getDirectoryProducts({ compound: "bpc-157", limit: 50, sort: "best", stores: ["olive-store"] });
		expect(vi.mocked(unstable_cache).mock.calls[1]?.[2]).toEqual({ tags: ["pepreviewpro:directory"], revalidate: 300 });
	});

	it("tags and times the 'use cache' reader the same way", async () => {
		vi.stubEnv("PEPREVIEWPRO_API_KEY", fakeKey("pk"));
		vi.stubGlobal("fetch", replayFetch(withCompound).fetch);
		await cacheComponents.getDirectoryStores({ compound: "bpc-157", sort: "best", limit: 3 });
		expect(cacheTag).toHaveBeenCalledWith("pepreviewpro:directory");
		expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 300, expire: 3600 });
	});
});

describe("cacheTags", () => {
	it("is the contract's spelling", () => {
		expect(cacheTags("magnolia-store")).toEqual(["pepreviewpro:magnolia-store"]);
		expect(cacheTags("magnolia-store", 88)).toEqual(["pepreviewpro:magnolia-store", "pepreviewpro:magnolia-store:product:88"]);
	});
});

describe("ReviewsJsonLd", () => {
	it("prints the product's markup from the cached read", async () => {
		vi.stubGlobal("fetch", replayFetch(byRef).fetch);
		const element = await ReviewsJsonLd({ product: { name: "BPC-157 10mg", url: "https://store.example/p/bpc-157-10mg", productRef: "sku-101" } });
		const html = renderToStaticMarkup(element);
		expect(html).toMatch(/^<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"Product"/);
		expect(html).toContain(`"reviewCount":${body.aggregate.total}`);
	});
});

describe("checkoutContext", () => {
	it("reads the cookies, IP, and user agent as order fields, leaving out what is missing", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.7, 198.51.100.1",
			"user-agent": "Mozilla/5.0",
			"cookie": "prp_reviews_seen=1762092000"
		});
		expect(checkoutContext(new Request("https://store.example/checkout", { headers }))).toEqual({
			customerIp: "203.0.113.7",
			customerUserAgent: "Mozilla/5.0",
			reviewsSeenAt: 1762092000
		});
		expect(checkoutContext(headers)).toEqual(checkoutContext({ headers: Object.fromEntries(headers) }));
		expect(checkoutContext(new Headers({ "sec-gpc": "1", "user-agent": "Mozilla/5.0" }))).toEqual({});
	});
});
