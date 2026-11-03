/** `items` in runs of `size`, the last one shorter. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
	const runs: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		runs.push(items.slice(start, start + size));
	}

	return runs;
}
