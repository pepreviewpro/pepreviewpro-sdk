export interface BackoffOptions {
	/** Delay before the first retry, before jitter. */
	baseDelayMs: number;
	maxDelayMs: number;
	/** Returns a number in [0, 1). Injected so tests are deterministic. */
	random: () => number;
}

/**
 * How long to wait before retry number `attempt` (0 for the first retry): exponential with full jitter, so many
 * clients that failed together do not retry together. A `Retry-After` from the server is a floor, never shortened.
 */
export function backoffDelay(attempt: number, retryAfterMs: number | null, { baseDelayMs, maxDelayMs, random }: BackoffOptions): number {
	const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
	const jittered = Math.floor(random() * ceiling);
	return retryAfterMs === null ? jittered : Math.max(retryAfterMs, jittered);
}
