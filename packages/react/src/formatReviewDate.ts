const FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * A review's date like "Oct 3, 2026". Fixed to one locale and UTC so the server's HTML and the browser's render
 * print the same text, which hydration requires. Empty for a date that does not parse.
 */
export function formatReviewDate(value: string): string {
	const time = Date.parse(value);
	return Number.isNaN(time) ? "" : FORMAT.format(time);
}
