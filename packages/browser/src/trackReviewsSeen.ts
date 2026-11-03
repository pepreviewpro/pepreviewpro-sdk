import { REVIEWS_SEEN_COOKIE, REVIEWS_SEEN_DAYS } from "./cookieNames";
import { isTrackingAllowed } from "./isTrackingAllowed";
import type { TrackingOptions } from "./types";
import { writeCookie } from "./writeCookie";

/** At least half the reviews on screen, the rule the widgets runtime uses. */
const VISIBLE = 0.5;

/**
 * Marks in the `prp_reviews_seen` cookie that the shopper saw the store's reviews, once `element` is at least half
 * on screen. The server package copies it onto the order, which earns the order the `widget` match. Call it only
 * for an element that shows reviews. Returns a function that stops watching.
 */
export function trackReviewsSeen(element: Element, options: TrackingOptions = {}): () => void {
	if (typeof IntersectionObserver === "undefined" || !isTrackingAllowed(options.consent)) {
		return () => {};
	}

	const observer = new IntersectionObserver(
		(entries) => {
			const seen = entries.some(
				// An element with nothing rendered has no box, and a zero-area box counts as intersecting.
				(entry) => entry.isIntersecting && entry.intersectionRatio >= VISIBLE && entry.boundingClientRect.width * entry.boundingClientRect.height > 0
			);
			if (!seen || !isTrackingAllowed(options.consent)) {
				return;
			}

			observer.disconnect();
			writeCookie(REVIEWS_SEEN_COOKIE, String(Math.floor(Date.now() / 1000)), REVIEWS_SEEN_DAYS, options.cookieDomain);
		},
		{ threshold: VISIBLE }
	);
	observer.observe(element);
	return () => observer.disconnect();
}
