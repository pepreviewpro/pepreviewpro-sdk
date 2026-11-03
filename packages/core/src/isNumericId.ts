import type { ExternalId } from "./types";

const DIGITS = /^[1-9]\d*$/;

/** Where the API's surrogates for mapped ids start. An id this large is mapped too, so it can never collide with one. */
const SURROGATE_START = 9_000_000_000_000;

/**
 * Whether the API passes this id through as its own number instead of mapping it: a positive integer below
 * 9,000,000,000,000, or a string of such digits with no leading zero. `"0123"` is a string id, so it maps.
 */
export function isNumericId(id: ExternalId): boolean {
	const value = typeof id === "number" ? id : DIGITS.test(id) ? Number(id) : Number.NaN;
	return Number.isSafeInteger(value) && value > 0 && value < SURROGATE_START;
}
