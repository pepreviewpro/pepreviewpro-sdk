/** A `Cookie` header as decoded name and value pairs. The first of repeated names wins, as browsers send the most specific first. */
export function parseCookieHeader(header: string | null): Map<string, string> {
	const cookies = new Map<string, string>();
	for (const pair of header?.split(";") ?? []) {
		const separator = pair.indexOf("=");
		if (separator === -1) {
			continue;
		}

		const name = pair.slice(0, separator).trim();
		if (!name || cookies.has(name)) {
			continue;
		}

		let value = pair.slice(separator + 1).trim();
		if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
			value = value.slice(1, -1);
		}

		try {
			cookies.set(name, decodeURIComponent(value));
		} catch {
			cookies.set(name, value);
		}
	}

	return cookies;
}
