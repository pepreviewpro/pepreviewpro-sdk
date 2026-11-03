import { PepReviewPro } from "@pepreviewpro/server";
import Stripe from "stripe";
import { createApp } from "./createApp";

const app = createApp({
	stripe: new Stripe(process.env.STRIPE_SECRET_KEY!),
	stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
	prp: new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! })
});
app.listen(3000, () => console.log("Listening on http://localhost:3000"));
