import { readEnv } from "./readEnv";

/** The store a read is for: the one passed, else `PEPREVIEWPRO_STORE`. Throws when neither is set. */
export function resolveStore(store: string | undefined): string {
	const slug = store?.trim() || readEnv().store;
	if (!slug) {
		throw new TypeError("Pass store, or set PEPREVIEWPRO_STORE to your store's slug.");
	}

	return slug;
}
