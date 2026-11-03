import { ATTRIBUTION_COOKIE, parseAttribution, parseReviewsSeen, REVIEWS_SEEN_COOKIE, type Attribution } from "@pepreviewpro/browser";
import { clientIp } from "./clientIp";
import { parseCookieHeader } from "./parseCookieHeader";
import { readHeader } from "./readHeader";
import type { RequestLike } from "./types";

export interface RequestContext {
	attribution: Attribution | null;
	reviewsSeenAt: number | null;
	ip: string | null;
	userAgent: string | null;
}

const EMPTY: RequestContext = { attribution: null, reviewsSeenAt: null, ip: null, userAgent: null };

/**
 * What the checkout request knows about the buyer: the `prp_attribution` and `prp_reviews_seen` cookies, the IP,
 * and the user agent. Empty when the browser sends Global Privacy Control (`Sec-GPC: 1`), since all of it is shared
 * with PepReviewPro for attribution.
 */
export function readRequestContext(request: RequestLike): RequestContext {
	if (readHeader(request.headers, "sec-gpc")?.trim() === "1") {
		return EMPTY;
	}

	const cookies = parseCookieHeader(readHeader(request.headers, "cookie"));
	return {
		attribution: parseAttribution(cookies.get(ATTRIBUTION_COOKIE)),
		reviewsSeenAt: parseReviewsSeen(cookies.get(REVIEWS_SEEN_COOKIE)),
		ip: clientIp(request.headers),
		userAgent: readHeader(request.headers, "user-agent")?.trim() || null
	};
}
