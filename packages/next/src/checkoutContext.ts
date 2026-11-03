import { readRequestContext, type HeadersLike, type Order, type RequestLike } from "@pepreviewpro/server";

export type CheckoutFields = Partial<Pick<Order, "attribution" | "customerIp" | "customerUserAgent" | "reviewsSeenAt">>;

/**
 * The buyer's attribution and reviews-seen cookies, IP address, and user agent, as order fields for
 * `orders.upsert`. Pass the route's `request`, or `await headers()` in a server action. Fields the request does not
 * carry are left out, so spreading the result never clears an order's own value. Empty under Global Privacy Control.
 */
export function checkoutContext(source: RequestLike | HeadersLike | Pick<Headers, "get">): CheckoutFields {
	const request = "headers" in source && typeof source.headers === "object" ? (source as RequestLike) : { headers: source as HeadersLike };
	const { attribution, reviewsSeenAt, ip, userAgent } = readRequestContext(request);
	return {
		...(attribution ? { attribution } : {}),
		...(reviewsSeenAt ? { reviewsSeenAt } : {}),
		...(ip ? { customerIp: ip } : {}),
		...(userAgent ? { customerUserAgent: userAgent } : {})
	};
}
