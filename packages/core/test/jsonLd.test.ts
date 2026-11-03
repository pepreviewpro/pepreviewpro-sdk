import { describe, expect, it } from "vitest";
import { fixtureCase } from "../../../test/replay";
import { productJsonLd, serializeJsonLd, type ProductJsonLd, type WidgetDataResponse } from "../src";

const data = fixtureCase("widget-data-product-ref", "one product by the store's own id").response.body as WidgetDataResponse;
const recorded = fixtureCase("get-widget-data", "by slug, with the store's minimum rating applied").response.body as WidgetDataResponse;
const product = { name: "BPC-157 10mg", url: "https://store.example/p/bpc-157-10mg", image: "https://store.example/img.jpg" };

/** What Google's Product review snippet needs, checked node by node against schema.org's Product, AggregateRating, and Review. */
function expectValidProductMarkup(markup: ProductJsonLd) {
	expect(markup["@context"]).toBe("https://schema.org");
	expect(markup["@type"]).toBe("Product");
	expect(markup.name).toEqual(expect.any(String));
	expect(markup.url).toMatch(/^https:\/\//);
	const rating = markup.aggregateRating;
	expect(rating).toBeDefined();
	expect(rating?.["@type"]).toBe("AggregateRating");
	expect(rating?.ratingValue).toBeGreaterThanOrEqual(1);
	expect(rating?.ratingValue).toBeLessThanOrEqual(5);
	expect(Number.isInteger(rating?.reviewCount)).toBe(true);
	expect(rating?.reviewCount).toBeGreaterThan(0);
	expect(rating).toMatchObject({ bestRating: 5, worstRating: 1 });
	expect(markup.review?.length ?? 0).toBeLessThanOrEqual(10);
	for (const review of markup.review ?? []) {
		expect(review["@type"]).toBe("Review");
		expect(review.reviewRating).toMatchObject({ "@type": "Rating", "bestRating": 5, "worstRating": 1 });
		expect(Number.isInteger(review.reviewRating.ratingValue)).toBe(true);
		expect(review.author["@type"]).toBe("Person");
		expect(review.author.name.length).toBeGreaterThan(0);
		expect(review.reviewBody.length).toBeGreaterThan(0);
		expect(review.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(Object.keys(review)).not.toContain("publisher");
	}
}

describe("productJsonLd", () => {
	it("marks up the product with the widget's rating and its visible reviews", () => {
		const markup = productJsonLd({ ...product, reviews: data.reviews, aggregate: data.aggregate, minRating: data.settings!.min_rating_display });
		expect(markup).not.toBeNull();
		expectValidProductMarkup(markup as ProductJsonLd);
		expect(markup?.aggregateRating).toEqual({ "@type": "AggregateRating", "ratingValue": 3.86, "reviewCount": 4, "bestRating": 5, "worstRating": 1 });
		expect(markup?.review?.map((review) => review.reviewRating.ratingValue)).toEqual([5, 4, 5]);
		expect(markup?.review?.[0]).toEqual({
			"@type": "Review",
			"reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5, "worstRating": 1 },
			"author": { "@type": "Person", "name": "Sam D." },
			"reviewBody": "Body of review 1. Shipped fast and matched the label.",
			"name": "Review 1",
			"datePublished": "2026-10-01T14:21:07.512Z"
		});
		expect(markup?.image).toBe(product.image);
	});

	it("caps Review nodes at 10", () => {
		const reviews = Array.from({ length: 25 }, (_, index) => ({ ...recorded.reviews[0]!, id: String(index) }));
		const markup = productJsonLd({ ...product, reviews, aggregate: { ...recorded.aggregate, total: 25 }, maxReviews: 50 });
		expect(markup?.review).toHaveLength(10);
	});

	it("uses the plain average only when there is no score", () => {
		const markup = productJsonLd({ ...product, reviews: [], aggregate: { average_rating: 4.5, total: 2 } });
		expect(markup?.aggregateRating?.ratingValue).toBe(4.5);
		expect(markup?.review).toBeUndefined();
	});

	it("is null with no reviews and no offers, and keeps the store's offers when given", () => {
		const empty = { average_rating: 0, score: 0, total: 0 };
		expect(productJsonLd({ ...product, reviews: [], aggregate: empty })).toBeNull();
		const offers = { "@type": "Offer", "price": "49.50", "priceCurrency": "USD" };
		const markup = productJsonLd({ ...product, reviews: [], aggregate: empty, offers, brand: "Magnolia", sku: "bpc-157-10mg" });
		expect(markup).toMatchObject({ offers, brand: { "@type": "Brand", "name": "Magnolia" }, sku: "bpc-157-10mg" });
		expect(markup?.aggregateRating).toBeUndefined();
	});
});

describe("serializeJsonLd", () => {
	it("cannot close the script tag it sits in", () => {
		const markup = productJsonLd({ ...product, reviews: data.reviews, aggregate: data.aggregate });
		const json = serializeJsonLd(markup);
		expect(json).not.toMatch(/<\/script/i);
		expect(json).toContain("\\u003c/script\\u003e");
		expect(JSON.parse(json)).toEqual(markup);
	});
});
