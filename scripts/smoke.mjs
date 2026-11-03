/**
 * Runs the built packages on the oldest supported Node without the toolchain, which needs Node 22: CI runs this on
 * Node 20 after building on a newer one. Plain JavaScript on purpose, so nothing has to compile it first.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = (name, file = "index.js") => new URL(`../packages/${name}/dist/${file}`, import.meta.url).href;
const { PepReviewPro, verifyWebhook } = await import(dist("server"));
const browser = await import(dist("browser"));
const core = await import(dist("core"));

const requests = [];
const fetch = async (url, init) => {
	requests.push({ url, init });
	const { orders } = JSON.parse(init.body);
	return new Response(
		JSON.stringify({
			store: "smoke",
			results: orders.map((order) => ({ id: String(order.id), status: "created", queued: 1, duplicates: 0 }))
		})
	);
};

const sdk = new PepReviewPro({ store: "smoke", apiKey: `sk_live_${"a".repeat(40)}`, fetch, heartbeat: false });
const request = new Request("https://store.example/checkout", {
	headers: { "x-forwarded-for": "203.0.113.7", "cookie": "prp_reviews_seen=1762092000" }
});
const outcome = await sdk.orders.upsert({ id: "ORD-1", status: "completed", email: "a@example.com" }, { request });
assert.deepEqual(outcome, { id: "ORD-1", status: "created", queued: 1, duplicates: 0 });
const sent = JSON.parse(requests[0].init.body).orders[0];
assert.equal(sent.customer_ip, "203.0.113.7");
assert.equal(sent.reviews_seen_at, 1762092000);
assert.match(requests[0].init.headers["idempotency-key"], /^prp_/);

const event = await verifyWebhook(
	'{"test": 2432232314}',
	{
		"webhook-id": "msg_p5jXN8AQM9LWM0D4loKWxJek",
		"webhook-timestamp": "1614265330",
		"webhook-signature": "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
	},
	{ secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", now: 1614265330000 }
);
assert.equal(event.test, 2432232314);
assert.equal(browser.captureAttribution(), null);
assert.equal(core.isNumericId("1002"), true);
const built = (name, file) => readFileSync(new URL(`../packages/${name}/dist/${file}`, import.meta.url), "utf8");
for (const file of ["Carousel.js", "ReviewForm.js", "RuntimeWidget.js", "PepReviewProProvider.js", "useReviews.js"]) {
	assert.ok(built("react", file).startsWith('"use client";'), `react/dist/${file} lost its "use client"`);
}

for (const file of ["index.js", "Stars.js", "ReviewList.js", "ReviewsJsonLd.js"]) {
	assert.ok(!built("react", file).includes('"use client"'), `react/dist/${file} must stay a Server Component`);
}

assert.match(built("next", "cache-components.js"), /async function getReviews\([^)]*\) \{\s*"use cache";/);
const react = await import(dist("react"));
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
assert.match(renderToStaticMarkup(createElement(react.Stars, { rating: 4.8 })), /aria-label="Rated 4\.8 out of 5"/);
const version = execFileSync(process.execPath, [fileURLToPath(dist("cli", "index.mjs")), "--version"], { encoding: "utf8" }).trim();
assert.match(version, /^\d+\.\d+\.\d+/);
console.log(`Smoke passed on Node ${process.versions.node}.`);
