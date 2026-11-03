import type { PepReviewPro } from "@pepreviewpro/server";
import express from "express";
import type Stripe from "stripe";
import { checkoutMetadata } from "./checkoutMetadata";
import { toOrder } from "./toOrder";

export interface AppOptions {
	stripe: Stripe;
	/** The `whsec_` signing secret of the Stripe webhook endpoint. */
	stripeWebhookSecret: string;
	prp: PepReviewPro;
	/** Defaults to Stripe's API. Tests pass their own. */
	listLineItems?: (sessionId: string) => Promise<Stripe.LineItem[]>;
}

/**
 * Stripe Checkout in, PepReviewPro orders out. `POST /checkout` starts a session carrying the buyer's context;
 * `POST /webhooks/stripe` sends the order when Stripe says the checkout completed.
 */
export function createApp({ stripe, stripeWebhookSecret, prp, listLineItems }: AppOptions) {
	const lineItemsOf = listLineItems ?? (async (id: string) => (await stripe.checkout.sessions.listLineItems(id, { limit: 100 })).data);
	const app = express();
	app.post("/checkout", express.json(), async (request, response) => {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items: request.body.items,
			client_reference_id: request.body.orderId,
			metadata: checkoutMetadata(request),
			success_url: "https://store.example/thanks"
		});
		response.json({ url: session.url });
	});
	// Stripe signs the exact bytes, so this route reads the raw body.
	app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (request, response) => {
		let event: Stripe.Event;
		try {
			event = stripe.webhooks.constructEvent(request.body as Buffer, request.header("stripe-signature") ?? "", stripeWebhookSecret);
		} catch {
			response.status(400).json({ error: "Bad Stripe signature." });
			return;
		}

		if (event.type === "checkout.session.completed") {
			const session = event.data.object;
			await prp.orders.upsert(toOrder(session, await lineItemsOf(session.id)), { idempotencyKey: event.id });
		}

		response.json({ received: true });
	});
	return app;
}
