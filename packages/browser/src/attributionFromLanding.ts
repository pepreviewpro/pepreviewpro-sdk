import type { Attribution } from "./types";

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_ID = "prp_click_id";
/** Keeps the cookie well under the 4 kB browsers allow per cookie. */
const MAX_URL = 1000;

/** The landing URL without its fragment, cut down to the tags that matter when the whole thing is too long. */
function landingUrl(url: URL): string {
	const full = url.origin + url.pathname + url.search;
	if (full.length <= MAX_URL) {
		return full;
	}

	const kept = new URLSearchParams();
	for (const name of [CLICK_ID, ...UTM]) {
		const value = url.searchParams.get(name);
		if (value) {
			kept.set(name, value);
		}
	}

	return `${url.origin}${url.pathname}?${kept}`.slice(0, MAX_URL);
}

function externalReferrer(referrer: string | null | undefined, host: string): string | null {
	try {
		return referrer && new URL(referrer).host !== host ? referrer.slice(0, MAX_URL) : null;
	} catch {
		return null;
	}
}

/**
 * The first touch a landing on `url` records: when it carries `prp_click_id`, a UTM tag, or a referrer from another
 * site. Null for a landing that says nothing about where the shopper came from. Pure, so the browser and the
 * Next.js proxy apply the same rules.
 */
export function attributionFromLanding(url: URL | string, referrer: string | null | undefined, now: Date = new Date()): Attribution | null {
	const landing = typeof url === "string" ? new URL(url) : url;
	const external = externalReferrer(referrer, landing.host);
	const tags = Object.fromEntries(UTM.map((name) => [name, landing.searchParams.get(name) || null])) as Record<(typeof UTM)[number], string | null>;
	if (!landing.searchParams.get(CLICK_ID) && !external && UTM.every((name) => !tags[name])) {
		return null;
	}

	return { landing_url: landingUrl(landing), referrer: external, ...tags, first_seen_at: now.toISOString() };
}
