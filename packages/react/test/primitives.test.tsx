import type { WidgetData, WidgetDataResponse } from "@pepreviewpro/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureCase } from "../../../test/replay";
import { ReviewList, ReviewsJsonLd, Stars, VerifiedBadge } from "../src";

const response = fixtureCase("widget-data-product-ref", "one product by the store's own id").response.body as WidgetDataResponse;
const data: WidgetData = { store: response.store, settings: response.settings, reviews: response.reviews, aggregate: response.aggregate };

describe("server-rendered primitives", () => {
	it("prints stars as one labelled image", () => {
		const html = renderToStaticMarkup(<Stars rating={4.85} />);
		expect(html).toContain('role="img" aria-label="Rated 4.9 out of 5"');
		expect(html.match(/data-filled=""/g)).toHaveLength(5);
		expect(renderToStaticMarkup(<Stars rating={3.2} />).match(/data-filled=""/g)).toHaveLength(3);
	});

	it("lists every review with its author, date, and the verified mark", () => {
		const html = renderToStaticMarkup(<ReviewList reviews={data.reviews} />);
		for (const review of data.reviews) {
			expect(html).toContain(review.reviewer_name);
		}

		expect(html.match(/<article>/g)).toHaveLength(data.reviews.length);
		expect(html).toMatch(/<time dateTime="[^"]+">[A-Z][a-z]{2} \d{1,2}, 20\d\d<\/time>/);
		expect(html.match(/Verified purchase/g)?.length).toBe(data.reviews.filter((review) => review.is_verified).length);
		expect(renderToStaticMarkup(<ReviewList reviews={data.reviews} showVerified={false} />)).not.toContain("Verified purchase");
	});

	it("names the verified mark in the dashboard's words unless given others", () => {
		expect(renderToStaticMarkup(<VerifiedBadge />)).toBe('<span data-prp-verified="">Verified purchase</span>');
		expect(renderToStaticMarkup(<VerifiedBadge>Verified</VerifiedBadge>)).toContain(">Verified<");
	});

	it("prints Product JSON-LD with the widget's rating and escapes a closing script tag", () => {
		const hostile = { ...data, reviews: [{ ...data.reviews[0]!, rating: 5, body: "</script><script>alert(1)</script>" }] };
		const html = renderToStaticMarkup(<ReviewsJsonLd data={hostile} product={{ name: "BPC-157 10mg", url: "https://store.example/p/bpc-157-10mg" }} />);
		expect(html).not.toContain("</script><script>");
		const json = JSON.parse(html.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "")) as Record<string, unknown>;
		expect(json).toMatchObject({ "@type": "Product", "aggregateRating": { ratingValue: data.aggregate.score, reviewCount: data.aggregate.total } });
	});

	it("prints nothing for a product with no reviews", () => {
		const empty = { ...data, reviews: [], aggregate: { ...data.aggregate, total: 0 } };
		expect(renderToStaticMarkup(<ReviewsJsonLd data={empty} product={{ name: "x", url: "https://store.example/" }} />)).toBe("");
	});

	it("keeps the server-safe modules free of hooks and the client ones marked", async () => {
		const { readdir, readFile } = await import("node:fs/promises");
		const dir = new URL("../src/", import.meta.url);
		const server = ["Stars.tsx", "ReviewList.tsx", "VerifiedBadge.tsx", "ReviewsJsonLd.tsx", "RatingSummary.tsx", "index.ts"];
		for (const file of await readdir(dir)) {
			const source = await readFile(new URL(file, dir), "utf8");
			const client = source.startsWith('"use client";');
			if (server.includes(file)) {
				expect(client, file).toBe(false);
				expect(source, file).not.toMatch(/\buse(State|Effect|Context|Ref)\b/);
			} else if (/\buse(State|Effect|Context|Ref|Id|Callback|Memo)\(/.test(source) || /createContext/.test(source)) {
				expect(client, file).toBe(true);
			}
		}
	});
});
