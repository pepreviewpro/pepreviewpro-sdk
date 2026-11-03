/** One cookie's decoded value from `document.cookie`, or null. */
export function readCookie(name: string): string | null {
	if (typeof document === "undefined") {
		return null;
	}

	for (const pair of document.cookie.split(";")) {
		const separator = pair.indexOf("=");
		if (separator !== -1 && pair.slice(0, separator).trim() === name) {
			try {
				return decodeURIComponent(pair.slice(separator + 1).trim());
			} catch {
				return null;
			}
		}
	}

	return null;
}
