import { ATTRIBUTION_COOKIE, REVIEWS_SEEN_COOKIE } from "./cookieNames";
import { isTrackingAllowed } from "./isTrackingAllowed";
import { parseAttribution } from "./parseAttribution";
import { parseReviewsSeen } from "./parseReviewsSeen";
import { readCookie } from "./readCookie";
import type { CheckoutContext, TrackingOptions } from "./types";

/**
 * What to send with the checkout request so the server can pass it on with the order. The server package also
 * reads both cookies from the request itself, so this is only needed when checkout runs on another host.
 */
export function readCheckoutContext(options: Pick<TrackingOptions, "consent"> = {}): CheckoutContext {
	if (!isTrackingAllowed(options.consent)) {
		return { attribution: null, reviews_seen_at: null };
	}

	return { attribution: parseAttribution(readCookie(ATTRIBUTION_COOKIE)), reviews_seen_at: parseReviewsSeen(readCookie(REVIEWS_SEEN_COOKIE)) };
}
