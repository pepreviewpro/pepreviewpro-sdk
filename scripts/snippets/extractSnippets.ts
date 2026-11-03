export interface Snippet {
	/** 1-based line of the snippet's first code line in the Markdown file. */
	line: number;
	language: "ts" | "tsx";
	code: string;
}

/** Put this on the line above a fence to leave a deliberately partial sample out of the type check. */
export const PARTIAL_MARKER = "<!-- snippet: partial -->";

const LANGUAGES: Record<string, Snippet["language"]> = { ts: "ts", typescript: "ts", tsx: "tsx" };

/**
 * The TypeScript and TSX code blocks in a Markdown file, except those marked partial. Blocks nested in lists keep
 * their indentation stripped, so a numbered step's sample checks the same as a top-level one.
 */
export function extractSnippets(markdown: string): Snippet[] {
	const lines = markdown.split(/\r?\n/);
	const snippets: Snippet[] = [];
	let previous = "";
	for (let index = 0; index < lines.length; index++) {
		const open = lines[index]!.match(/^(\s*)(`{3,}|~{3,})\s*([\w-]*)/);
		if (!open) {
			if (lines[index]!.trim() !== "") {
				previous = lines[index]!.trim();
			}

			continue;
		}

		const [, indent = "", fence = "", info = ""] = open;
		const start = index + 1;
		let end = start;
		while (end < lines.length && !lines[end]!.trim().startsWith(fence)) {
			end++;
		}

		const language = LANGUAGES[info.toLowerCase()];
		if (language && previous !== PARTIAL_MARKER) {
			const code = lines
				.slice(start, end)
				.map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
				.join("\n");
			snippets.push({ line: start + 1, language, code });
		}

		previous = "";
		index = end;
	}

	return snippets;
}
