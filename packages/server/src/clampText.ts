/** `text` trimmed and cut to `max` UTF-16 units, the way the API counts, without leaving half of a surrogate pair. */
export function clampText(text: string, max: number): string {
	const cut = text.trim().slice(0, max);
	return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}
