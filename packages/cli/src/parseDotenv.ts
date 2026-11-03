/** `KEY=value` lines from a .env file. Skips comments and blank lines, strips `export` and matching quotes. */
export function parseDotenv(text: string): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const line of text.split(/\r?\n/)) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match?.[1]) {
			continue;
		}

		let value = match[2] ?? "";
		const quote = value[0];
		if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
			value = value.slice(1, -1);
		} else {
			value = value.replace(/\s+#.*$/, "");
		}

		vars[match[1]] = value;
	}

	return vars;
}
