/** Whether a dotted version like `11.6.2` is at least `minimum`. Pre-release suffixes are ignored. */
export function meetsVersion(version: string, minimum: string): boolean {
	const parse = (value: string) => value.trim().replace(/^v/, "").split("-")[0]!.split(".").map(Number);
	const actual = parse(version);
	const required = parse(minimum);
	for (let index = 0; index < required.length; index++) {
		const difference = (actual[index] ?? 0) - (required[index] ?? 0);
		if (difference !== 0) {
			return difference > 0;
		}
	}

	return true;
}
