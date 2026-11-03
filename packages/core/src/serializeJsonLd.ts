const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * JSON for the inside of a `<script type="application/ld+json">`. A review body containing `</script>` would
 * otherwise close the tag and inject HTML, so `<`, `>`, `&`, and the JS line separators are escaped.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(UNSAFE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
