/** Codes people and models write that ISO 3166 spells otherwise. */
const ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };

let names: Intl.DisplayNames | null | undefined;

/** A two-letter country code and its English name, or null when `text` is not a country's code. */
export function readCountry(text: string | null | undefined): { code: string; name: string } | null {
	const upper = text?.trim().toUpperCase() ?? "";
	const code = ALIASES[upper] ?? upper;
	if (!/^[A-Z]{2}$/.test(code)) {
		return null;
	}

	names ??= typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }) : null;
	const name = names ? names.of(code) : code;
	return name && name !== "Unknown Region" ? { code, name } : null;
}
