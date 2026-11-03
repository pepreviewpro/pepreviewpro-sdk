import type { TrackingOptions } from "./types";

/** False under Global Privacy Control, or when the store's `consent` says no. True when nobody has said either. */
export function isTrackingAllowed(consent: TrackingOptions["consent"]): boolean {
	if (typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) {
		return false;
	}

	return typeof consent === "function" ? consent() : consent !== false;
}
