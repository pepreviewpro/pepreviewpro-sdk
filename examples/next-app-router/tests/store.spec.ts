import type { WidgetData } from "@pepreviewpro/react";
import { signWebhook } from "@pepreviewpro/server";
import { expect, test } from "@playwright/test";
import { fixtureCase } from "../../../test/replay";
import { WEBHOOK_SECRET } from "../playwright.config";

const REPLAY = "http://127.0.0.1:4010";
const PRODUCT = "/products/sku-101";

interface ProductMarkup {
	"@type": string;
	"name": string;
	"aggregateRating": { "@type": string; "ratingValue": number; "reviewCount": number; "bestRating": number; "worstRating": number };
	"review": { "@type": string; "author": { name: string }; "reviewRating": { ratingValue: number }; "reviewBody": string }[];
}

/** Text as React writes it into HTML. */
const escaped = (text: string) =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const jsonLdOf = (html: string) => {
	const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
	return match ? (JSON.parse(match[1]!) as ProductMarkup) : null;
};

test("the product page has its reviews in the server HTML, outside any script or attribute", async ({ request }) => {
	const html = await (await request.get(PRODUCT)).text();
	const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/data-pepreviews-widget="[^"]*"/g, "");
	const recorded = fixtureCase("widget-data-product-ref", "one product by the store's own id").response.body as WidgetData;
	const shown = recorded.reviews.filter((review) => review.rating >= recorded.settings!.min_rating_display);
	expect(shown.length).toBeGreaterThan(0);
	for (const review of shown) {
		expect(visible).toContain(`<p data-prp-review-body="">${escaped(review.body)}</p>`);
	}

	expect(visible).toMatch(/out of 5 from \d+ reviews/);
	expect(html).toContain("data-pepreviews-widget=");
});

test("the JSON-LD is valid Product markup with the widget's own rating", async ({ request }) => {
	const html = await (await request.get(PRODUCT)).text();
	const markup = jsonLdOf(html)!;
	expect(markup["@type"]).toBe("Product");
	expect(markup.name).toBe("BPC-157 10mg");
	const widget = JSON.parse(
		html
			.match(/data-pepreviews-widget="([^"]+)"/)![1]!
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, "&")
	) as { data: { aggregate: { score: number; total: number } } };
	expect(markup.aggregateRating).toEqual({
		"@type": "AggregateRating",
		"ratingValue": widget.data.aggregate.score,
		"reviewCount": widget.data.aggregate.total,
		"bestRating": 5,
		"worstRating": 1
	});
	expect(markup.review.length).toBeGreaterThan(0);
	expect(markup.review.length).toBeLessThanOrEqual(10);
	for (const node of markup.review) {
		expect(node["@type"]).toBe("Review");
		expect(node.author.name).not.toBe("");
		expect(node.reviewRating.ratingValue).toBeGreaterThanOrEqual(1);
	}
});

test("the widget mounts in a shadow root from the runtime", async ({ page }) => {
	await page.goto(PRODUCT);
	const host = page.locator("[data-pepreviews-widget]").first();
	await expect
		.poll(() => host.evaluate((element) => element.shadowRoot?.querySelector(".pep-widget")?.getAttribute("data-widget-type")))
		.toBe("mini-stars");
});

test("the first landing records attribution in the proxy, before any JavaScript runs", async ({ request }) => {
	const response = await request.get("/?prp_click_id=abc&utm_source=pepreviewpro", { headers: { referer: "https://pepreviewpro.com/" } });
	const cookie = response.headers()["set-cookie"] ?? "";
	expect(cookie).toMatch(/^prp_attribution=/);
	expect(decodeURIComponent(cookie)).toContain('"utm_source":"pepreviewpro"');
});

test("checkout sends the order with the buyer's context", async ({ page }) => {
	await page.context().addCookies([{ name: "prp_reviews_seen", value: String(Math.floor(Date.now() / 1000)), url: "http://127.0.0.1:3100" }]);
	await page.goto(PRODUCT);
	await page.getByRole("button", { name: "Place order" }).click();
	await expect(page.getByRole("status").filter({ hasText: /^Order ORD-/ })).toContainText("is created");
	const calls = (await (await page.request.get(`${REPLAY}/__replay/requests`)).json()) as {
		path: string;
		body: { orders: Record<string, unknown>[] };
	}[];
	const sent = calls.findLast((call) => call.path === "/api/v1/orders")!.body.orders[0]!;
	expect(sent).toMatchObject({ status: "completed", email: "buyer@example.com", line_items: [{ product_id: "sku-101" }] });
	expect(sent["customer_user_agent"]).toMatch(/Mozilla/);
	expect(sent["reviews_seen_at"]).toEqual(expect.any(Number));
});

test("a signed webhook revalidates the page, and a bad signature is refused", async ({ request }) => {
	const run = Date.now();
	const review = {
		id: `9a8b7c6d-0000-4000-8000-${String(run).padStart(12, "0").slice(-12)}`,
		reviewer_name: "Pat Q.",
		rating: 5,
		title: "Published after the build",
		body: `This review was approved after the page was built, in run ${run}.`,
		is_verified: true,
		created_at: new Date().toISOString(),
		product_ref: "sku-101",
		order_ref: null,
		updated_at: new Date().toISOString()
	};
	expect(await (await request.get(PRODUCT)).text()).not.toContain(review.body);
	await request.post(`${REPLAY}/__replay/reviews`, { data: { store: "magnolia-store", review } });
	expect(await (await request.get(PRODUCT)).text()).not.toContain(review.body);
	const body = JSON.stringify({ type: "review.published", timestamp: new Date().toISOString(), data: { store: "magnolia-store", ...review } });
	const forged = await request.post("/api/pepreviewpro", {
		headers: await signWebhook({ secret: "whsec_dGhlIHdyb25nIHNlY3JldCBlbnRpcmVseQ==", body }),
		data: body
	});
	expect(forged.status()).toBe(401);
	const delivered = await request.post("/api/pepreviewpro", {
		headers: { "content-type": "application/json", ...(await signWebhook({ secret: WEBHOOK_SECRET, body })) },
		data: body
	});
	expect(delivered.status()).toBe(200);
	expect(await delivered.json()).toMatchObject({ revalidated: ["pepreviewpro:magnolia-store", "pepreviewpro:magnolia-store:product:sku-101"] });
	await expect.poll(async () => (await (await request.get(PRODUCT)).text()).includes(review.body), { timeout: 15_000 }).toBe(true);
});
