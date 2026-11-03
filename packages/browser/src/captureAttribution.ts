import { attributionFromLanding } from "./attributionFromLanding";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_DAYS } from "./cookieNames";
import { isTrackingAllowed } from "./isTrackingAllowed";
import { parseAttribution } from "./parseAttribution";
import { readCookie } from "./readCookie";
import type { Attribution, TrackingOptions } from "./types";
import { writeCookie } from "./writeCookie";

/**
 * Records where the shopper came from in the `prp_attribution` cookie: on a landing with `prp_click_id`, a UTM tag,
 * or a referrer from another site. First touch wins for 30 days, so a later visit never overwrites it. Returns the
 * stored first touch, or null. Writes only the store's own cookie and sends nothing anywhere.
 */
export function captureAttribution(options: TrackingOptions = {}): Attribution | null {
	if (typeof location === "undefined" || !isTrackingAllowed(options.consent)) {
		return null;
	}

	const existing = parseAttribution(readCookie(ATTRIBUTION_COOKIE));
	if (existing) {
		return existing;
	}

	const attribution = attributionFromLanding(location.href, document.referrer);
	if (attribution) {
		writeCookie(ATTRIBUTION_COOKIE, JSON.stringify(attribution), ATTRIBUTION_DAYS, options.cookieDomain);
	}

	return attribution;
}
