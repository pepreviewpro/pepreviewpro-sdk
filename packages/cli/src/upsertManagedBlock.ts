/**
 * `content` with `block` in place of the one between `start` and `end`, or with `block` appended when there is
 * none. Repeats are removed, so running it twice never leaves two blocks. Keeps the file's own line endings. The
 * start marker paired with an end is the last one before it, so a stray start marker never swallows the text after it.
 */
export function upsertManagedBlock(content: string, block: string, start: string, end: string): string {
	const eol = /\r\n/.test(content) ? "\r\n" : "\n";
	const replacement = block.replace(/\r?\n/g, eol);
	let result = content;
	let placed = false;
	let from = 0;
	for (;;) {
		const endAt = result.indexOf(end, from);
		const startAt = endAt === -1 ? -1 : result.lastIndexOf(start, endAt);
		if (endAt === -1 || startAt === -1 || startAt < from) {
			break;
		}

		const after = endAt + end.length;
		if (placed) {
			const trimmedEnd = result.slice(after).match(/^[\t ]*\r?\n/)?.[0].length ?? 0;
			const trimmedStart = result.slice(0, startAt).match(/\r?\n[\t ]*$/)?.[0].length ?? 0;
			result = result.slice(0, startAt - trimmedStart) + result.slice(after + trimmedEnd);
			from = startAt - trimmedStart;
		} else {
			result = result.slice(0, startAt) + replacement + result.slice(after);
			placed = true;
			from = startAt + replacement.length;
		}
	}

	if (placed) {
		return result;
	}

	const separator = result === "" ? "" : result.endsWith(`${eol}${eol}`) ? "" : result.endsWith(eol) ? eol : `${eol}${eol}`;
	return `${result}${separator}${replacement}${eol}`;
}
