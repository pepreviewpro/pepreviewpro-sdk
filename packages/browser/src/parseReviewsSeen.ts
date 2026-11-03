/** Earlier than this is not a mark the widgets could have written. */
const EARLIEST = 1_577_836_800;

/** The `prp_reviews_seen` cookie's unix seconds, or null when it is not a plausible time. A day of clock skew is allowed. */
export function parseReviewsSeen(raw: string | null | undefined, now: number = Date.now()): number | null {
	if (!raw || !/^\d+$/.test(raw.trim())) {
		return null;
	}

	const seconds = Number(raw.trim());
	return seconds >= EARLIEST && seconds <= now / 1000 + 86_400 ? seconds : null;
}
