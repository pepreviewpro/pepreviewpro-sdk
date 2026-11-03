import type { ExternalId } from "./types";

const MAX_LENGTH = 200;

/**
 * Throws a `TypeError` naming `label` unless `id` is one the API accepts: a positive safe integer or a non-empty
 * string up to 200 characters. Caught here so a bad id fails at the call, not as a 400 for the whole batch.
 */
export function assertId(id: unknown, label: string): asserts id is ExternalId {
	if (typeof id === "number") {
		if (!Number.isSafeInteger(id) || id <= 0) {
			throw new TypeError(`${label} must be a positive whole number or a string, got ${id}.`);
		}

		return;
	}

	if (typeof id !== "string" || id.trim() === "" || id.length > MAX_LENGTH) {
		throw new TypeError(`${label} must be a positive whole number or a non-empty string of up to ${MAX_LENGTH} characters.`);
	}
}
