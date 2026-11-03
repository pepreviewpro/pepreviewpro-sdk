/** A cache key part for a query, the same whatever order its fields were written in. */
export function directoryCacheKey(query: object): string {
	return JSON.stringify(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
}
