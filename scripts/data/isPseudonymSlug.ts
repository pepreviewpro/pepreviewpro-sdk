import { SENTINEL_SLUGS, STORE_WORDS } from "./dataPolicy";

const PSEUDONYM = new RegExp(`^(?:example|${STORE_WORDS.join("|")})-store$`, "i");
const SYNTHETIC_UUID = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/i;

/** Whether a store slug or site id is one of ours: a pseudonymous store, a sentinel, or a synthetic UUID. */
export function isPseudonymSlug(value: string): boolean {
	return PSEUDONYM.test(value) || SENTINEL_SLUGS.includes(value.toLowerCase()) || SYNTHETIC_UUID.test(value);
}
