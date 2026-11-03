import type { Attribution } from "./types";

const FIELDS = ["landing_url", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "first_seen_at"] as const;
const MAX_FIELD = 2000;

/**
 * The `prp_attribution` cookie's value as an `Attribution`, keeping only known string fields. Null when it is not
 * JSON or carries nothing. Pure, so the server package parses the cookie header with it too.
 */
export function parseAttribution(raw: string | null | undefined): Attribution | null {
	if (!raw) {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object") {
		return null;
	}

	const source = parsed as Record<string, unknown>;
	const attribution = {} as Attribution;
	for (const field of FIELDS) {
		const value = source[field];
		attribution[field] = typeof value === "string" && value ? value.slice(0, MAX_FIELD) : null;
	}

	return FIELDS.some((field) => field !== "first_seen_at" && attribution[field]) ? attribution : null;
}
