import type { Order } from "@pepreviewpro/server";
import type Stripe from "stripe";

const PAID = new Set(["paid", "no_payment_required"]);

/** A completed Checkout Session, its line items, and the metadata `checkoutMetadata` wrote, as a PepReviewPro order. */
export function toOrder(session: Stripe.Checkout.Session, lineItems: Stripe.LineItem[]): Order {
	const meta = session.metadata ?? {};
	const hasAttribution = Boolean(meta["prp_landing_url"] || meta["prp_referrer"] || meta["prp_utm_source"]);
	return {
		id: session.client_reference_id ?? session.id,
		status: PAID.has(session.payment_status) ? "paid" : "pending",
		email: session.customer_details?.email ?? null,
		name: session.customer_details?.name ?? null,
		total: session.amount_total === null ? null : session.amount_total / 100,
		currency: session.currency?.toUpperCase() ?? null,
		createdAt: new Date(session.created * 1000),
		lineItems: lineItems.map((item) => ({
			productId: typeof item.price?.product === "string" ? item.price.product : (item.price?.product.id ?? item.id),
			name: item.description ?? null,
			quantity: item.quantity ?? 1,
			total: item.amount_total / 100
		})),
		...(hasAttribution
			? {
					attribution: {
						landing_url: meta["prp_landing_url"] ?? null,
						referrer: meta["prp_referrer"] ?? null,
						utm_source: meta["prp_utm_source"] ?? null,
						utm_medium: meta["prp_utm_medium"] ?? null,
						utm_campaign: meta["prp_utm_campaign"] ?? null,
						utm_content: meta["prp_utm_content"] ?? null,
						utm_term: null,
						first_seen_at: null
					}
				}
			: {}),
		...(meta["prp_reviews_seen_at"] ? { reviewsSeenAt: Number(meta["prp_reviews_seen_at"]) } : {}),
		...(meta["prp_ip"] ? { customerIp: meta["prp_ip"] } : {}),
		...(meta["prp_user_agent"] ? { customerUserAgent: meta["prp_user_agent"] } : {})
	};
}
