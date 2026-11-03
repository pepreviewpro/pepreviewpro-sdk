/** A fresh `Idempotency-Key`. One per logical call, reused across that call's retries. */
export function createIdempotencyKey(): string {
	return `prp_${globalThis.crypto.randomUUID()}`;
}
