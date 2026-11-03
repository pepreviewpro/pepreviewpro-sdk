import { readRequestContext, type RequestLike } from "@pepreviewpro/server";

/** Stripe keeps metadata values to 500 characters. */
const MAX = 500;

/**
 * What the buyer's request knows, as Checkout Session metadata, so the webhook can send it with the order: the
 * attribution and reviews-seen cookies, IP, and user agent. Stripe's webhook comes from Stripe, not the buyer.
 */
export function checkoutMetadata(request: RequestLike): Record<string, string> {
	const { attribution, reviewsSeenAt, ip, userAgent } = readRequestContext(request);
	const fields: Record<string, string | null | undefined> = {
		prp_landing_url: attribution?.landing_url,
		prp_referrer: attribution?.referrer,
		prp_utm_source: attribution?.utm_source,
		prp_utm_medium: attribution?.utm_medium,
		prp_utm_campaign: attribution?.utm_campaign,
		prp_utm_content: attribution?.utm_content,
		prp_reviews_seen_at: reviewsSeenAt === null ? null : String(reviewsSeenAt),
		prp_ip: ip,
		prp_user_agent: userAgent
	};
	return Object.fromEntries(Object.entries(fields).flatMap(([key, value]) => (value ? [[key, value.slice(0, MAX)]] : [])));
}
