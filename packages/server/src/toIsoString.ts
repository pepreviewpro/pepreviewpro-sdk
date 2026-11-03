import type { DateInput } from "./types";

/** A Date or date string as ISO 8601. Strings are sent as given, so an offset the store chose survives. */
export function toIsoString(value: DateInput | null | undefined, field: string): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		if (Number.isNaN(Date.parse(value))) {
			throw new TypeError(`${field} must be an ISO 8601 date, got "${value}".`);
		}

		return value;
	}

	if (Number.isNaN(value.getTime())) {
		throw new TypeError(`${field} is an invalid Date.`);
	}

	return value.toISOString();
}
