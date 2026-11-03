"use server";
import { checkoutContext } from "@pepreviewpro/next";
import { PepReviewPro } from "@pepreviewpro/server";
import { headers } from "next/headers";
import { PRODUCTS, type ProductSlug } from "../../../lib/catalog";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE ?? "magnolia-store" });

/** The store's own checkout would charge the card here. Then it sends the order, with the buyer's context. */
export async function placeOrder(_previous: string | null, form: FormData): Promise<string> {
	const slug = String(form.get("slug")) as ProductSlug;
	const product = PRODUCTS[slug];
	const outcome = await prp.orders.upsert({
		id: `ORD-${Date.now()}`,
		status: "completed",
		email: String(form.get("email")),
		total: product.price,
		currency: "USD",
		lineItems: [{ productId: slug, name: product.name, quantity: 1, total: product.price }],
		completedAt: new Date(),
		...checkoutContext(await headers())
	});
	return `Order ${outcome.id} is ${outcome.status}. ${outcome.queued} review request queued.`;
}
