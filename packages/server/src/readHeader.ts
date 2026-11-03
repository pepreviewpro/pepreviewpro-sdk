import type { HeadersLike } from "./types";

/** One header from Fetch `Headers` or a Node-style object, first value if repeated. Null when absent. */
export function readHeader(headers: HeadersLike, name: string): string | null {
	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(name);
	}

	const lower = name.toLowerCase();
	const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lower)?.[1];
	return (Array.isArray(entry) ? entry[0] : entry) ?? null;
}
