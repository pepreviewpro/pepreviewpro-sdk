/** A host as `/go/` compares it: lowercase, without a leading `www.`. A bare domain is read as https. */
function comparableHost(url: string): string | null {
	const value = url.trim();
	try {
		return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
	} catch {
		return null;
	}
}

/**
 * Whether `/go/` will honour `to` for a store at `siteUrl`: a web address on the store's host or a subdomain of it.
 * The route ignores anything wider, so it can never be an open redirect. Mirrors the app's `overrideOnStoreHost`.
 */
export function isOnStoreSite(to: string, siteUrl: string): boolean {
	if (!URL.canParse(to) || !["http:", "https:"].includes(new URL(to).protocol)) {
		return false;
	}

	const host = comparableHost(to);
	const storeHost = comparableHost(siteUrl);
	return Boolean(host && storeHost && storeHost.includes(".") && (host === storeHost || host.endsWith(`.${storeHost}`)));
}
