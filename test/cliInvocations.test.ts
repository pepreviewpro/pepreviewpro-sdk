import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", "build", ".next", ".git", "api", "fixtures", "test-results", "playwright-report"]);
const TEXT = new Set([".md", ".mdx", ".ts", ".tsx", ".mts", ".mjs", ".js", ".json", ".astro", ".html", ".yml", ".yaml", ".sh"]);
/**
 * A runner that fetches a package by name. The CLI's package is `@pepreviewpro/cli`; its bin's short name is not a
 * package on npm, so anyone could publish one under it and these commands would run it on a user's machine.
 */
const UNSCOPED = /\b(?:npx|pnpx|bunx|pnpm dlx|yarn dlx|npm exec|npm x)\s+(?:-[\w-]+\s+)*pepreviewpro\b(?!\/)/;

function* textFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP.has(entry.name)) {
				yield* textFiles(join(dir, entry.name));
			}
		} else if (TEXT.has(extname(entry.name)) && entry.name !== "pnpm-lock.yaml") {
			yield join(dir, entry.name);
		}
	}
}

describe("CLI invocations", () => {
	it("always name the scoped package, in every doc, guide, example, and source string", () => {
		const self = relative(ROOT, import.meta.filename);
		const found = [...textFiles(ROOT)]
			.filter((file) => relative(ROOT, file) !== self)
			.flatMap((file) =>
				readFileSync(file, "utf8")
					.split("\n")
					.flatMap((line, index) => (UNSCOPED.test(line) ? [`${relative(ROOT, file)}:${index + 1}`] : []))
			);
		expect(found).toEqual([]);
	});

	it("catches the forms that fetch the unscoped name", () => {
		for (const command of [
			"npx pepreviewpro doctor",
			"npx -y pepreviewpro init",
			"pnpm dlx pepreviewpro",
			"bunx pepreviewpro",
			"npm exec pepreviewpro"
		]) {
			expect(UNSCOPED.test(command)).toBe(true);
		}

		expect(UNSCOPED.test("npx @pepreviewpro/cli doctor")).toBe(false);
		expect(UNSCOPED.test("pnpm pepreviewpro doctor")).toBe(false);
	});
});
