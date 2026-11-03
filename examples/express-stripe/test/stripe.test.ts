import { PepReviewPro } from "@pepreviewpro/server";
import type { AddressInfo } from "node:net";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, replayFetch } from "../../../test/replay";
import { createApp } from "../src/createApp";

const WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_offline");

/** A `checkout.session.completed` event as Stripe sends it, cut to the fields the handler reads. */
const event = {
	id: "evt_1",
	object: "event",
	type: "checkout.session.completed",
	data: {
		object: {
			id: "cs_test_1",
			object: "checkout.session",
			client_reference_id: "ORD-20001",
			payment_status: "paid",
			amount_total: 9900,
			currency: "usd",
			created: 1_762_092_000,
			customer_details: { email: "buyer@example.com", name: "Jane Buyer" },
			metadata: {
				prp_landing_url: "https://store.example/?prp_click_id=abc&utm_source=pepreviewpro",
				prp_utm_source: "pepreviewpro",
				prp_reviews_seen_at: "1762091000",
				prp_ip: "203.0.113.7",
				prp_user_agent: "Mozilla/5.0"
			}
		}
	}
};

const lineItems = [
	{ id: "li_1", description: "BPC-157 10mg", quantity: 2, amount_total: 9900, price: { product: "sku-101" } }
] as unknown as Stripe.LineItem[];

async function serve() {
	const { fetch, requests } = replayFetch(fixtureCase("orders", "a paid order on a completed trigger and a pending one queue nothing"));
	const prp = new PepReviewPro({ store: "magnolia-store", apiKey: fakeKey(), fetch, heartbeat: false });
	const server = createApp({ stripe, stripeWebhookSecret: WEBHOOK_SECRET, prp, listLineItems: async () => lineItems }).listen(0);
	await new Promise((resolve) => server.once("listening", resolve));
	return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests, close: () => server.close() };
}

describe("Stripe checkout to PepReviewPro", () => {
	it("sends a completed checkout as a paid order with the buyer's context", async () => {
		const app = await serve();
		const payload = JSON.stringify(event);
		const response = await fetch(`${app.url}/webhooks/stripe`, {
			method: "POST",
			headers: { "content-type": "application/json", "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
			body: payload
		});
		app.close();
		expect(response.status).toBe(200);
		expect(app.requests[0]?.headers.get("idempotency-key")).toBe("evt_1");
		expect(app.requests[0]?.body).toEqual({
			store: "magnolia-store",
			import: false,
			orders: [
				{
					id: "ORD-20001",
					status: "paid",
					email: "buyer@example.com",
					name: "Jane Buyer",
					total: 99,
					currency: "USD",
					created_at: "2025-11-02T14:00:00.000Z",
					line_items: [{ product_id: "sku-101", name: "BPC-157 10mg", quantity: 2, total: 99 }],
					attribution: {
						landing_url: "https://store.example/?prp_click_id=abc&utm_source=pepreviewpro",
						referrer: null,
						utm_source: "pepreviewpro",
						utm_medium: null,
						utm_campaign: null,
						utm_content: null,
						utm_term: null,
						first_seen_at: null
					},
					customer_ip: "203.0.113.7",
					customer_user_agent: "Mozilla/5.0",
					reviews_seen_at: 1762091000
				}
			]
		});
	});

	it("refuses a request Stripe did not sign, and sends nothing", async () => {
		const app = await serve();
		const response = await fetch(`${app.url}/webhooks/stripe`, {
			method: "POST",
			headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
			body: JSON.stringify(event)
		});
		app.close();
		expect(response.status).toBe(400);
		expect(app.requests).toHaveLength(0);
	});
});
