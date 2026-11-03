/** A `Retry-After` header in milliseconds: delta seconds or an HTTP date. Null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
	const trimmed = value?.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+(\.\d+)?$/.test(trimmed)) {
		return Math.round(Number(trimmed) * 1000);
	}

	// An HTTP date always names its month; without this, `Date.parse("-1")` reads a year.
	const date = /[a-z]/i.test(trimmed) ? Date.parse(trimmed) : Number.NaN;
	return Number.isNaN(date) ? null : Math.max(0, date - now);
}
