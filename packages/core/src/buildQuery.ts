/** A query string from a params object, leaving out `undefined` and `null`. Empty when nothing is set. */
export function buildQuery(params: object): string {
	const search = new URLSearchParams();
	for (const [name, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			search.set(name, String(value));
		}
	}

	const query = search.toString();
	return query ? `?${query}` : "";
}
