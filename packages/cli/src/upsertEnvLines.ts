/** `content` with each of `vars` set: an existing line is replaced in place, a new one is appended. Other lines are kept. */
export function upsertEnvLines(content: string, vars: Record<string, string>): string {
	const remaining = new Map(Object.entries(vars));
	const lines = content === "" ? [] : content.replace(/\n$/, "").split("\n");
	const updated = lines.map((line) => {
		const name = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
		if (!name || !remaining.has(name)) {
			return line;
		}

		const value = remaining.get(name);
		remaining.delete(name);
		return `${name}=${value}`;
	});
	for (const [name, value] of remaining) {
		updated.push(`${name}=${value}`);
	}

	return `${updated.join("\n")}\n`;
}
