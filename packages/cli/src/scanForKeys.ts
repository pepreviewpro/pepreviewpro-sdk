import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

export interface KeyFinding {
	file: string;
	line: number;
	/** The key's first 12 characters, never the whole key. */
	keyPrefix: string;
	/** A whole key, or only the prefix with no key after it, like a placeholder. */
	kind: "key" | "prefix";
}

const TEXT_FILES = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".html", ".htm", ".json", ".map", ".css", ".txt", ".svg", ".xml", ".rsc"]);
const WHOLE_KEY = /(?:pk|sk)_live_[A-Za-z0-9]{40}/g;
const PREFIX = /(?:pk|sk)_live_/g;
const MAX_BYTES = 50 * 1024 * 1024;

async function* walk(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "cache") {
			continue;
		}

		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(path);
		} else if (entry.isFile() && TEXT_FILES.has(extname(entry.name).toLowerCase())) {
			yield path;
		}
	}
}

function lineOf(text: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index++) {
		if (text.charCodeAt(index) === 10) {
			line++;
		}
	}

	return line;
}

/**
 * Every `pk_live_` or `sk_live_` in the text files under `dir`, the way a key leaks: built into the client bundle.
 * A whole key is a leak; a bare prefix is usually a placeholder, reported so it can be checked.
 */
export async function scanForKeys(dir: string): Promise<KeyFinding[]> {
	const findings: KeyFinding[] = [];
	for await (const path of walk(dir)) {
		if ((await stat(path)).size > MAX_BYTES) {
			continue;
		}

		const text = await readFile(path, "utf8");
		const keyOffsets = new Set<number>();
		for (const match of text.matchAll(WHOLE_KEY)) {
			keyOffsets.add(match.index);
			findings.push({ file: relative(dir, path), line: lineOf(text, match.index), keyPrefix: match[0].slice(0, 12), kind: "key" });
		}

		for (const match of text.matchAll(PREFIX)) {
			if (!keyOffsets.has(match.index)) {
				findings.push({ file: relative(dir, path), line: lineOf(text, match.index), keyPrefix: match[0], kind: "prefix" });
			}
		}
	}

	return findings;
}
