import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAgentGuides, PARTNER_PACKAGES } from "../scripts/agents/buildAgentGuides";
import { listPackages } from "../scripts/release/listPackages";

const root = new URL("../", import.meta.url).pathname;
const folders = listPackages(root).map((pkg) => pkg.folder);
const guides = buildAgentGuides(root, folders);

describe.each(folders)("packages/%s/AGENTS.md", (folder) => {
	const text = guides.get(folder) ?? "";

	it("matches docs/agents/ (run pnpm agents after editing there)", () => {
		expect(readFileSync(new URL(`packages/${folder}/AGENTS.md`, `file://${root}`), "utf8")).toBe(text);
	});

	it("says whose codebase it is for and that the key is secret", () => {
		expect(text.startsWith(`# @pepreviewpro/${folder}: a guide for coding agents`)).toBe(true);
		expect(text).toMatch(/secret/);
		if (PARTNER_PACKAGES.has(folder)) {
			expect(text).toContain("directory partner");
			expect(text).toContain("clickUrl");
		} else {
			expect(text).toContain("npx @pepreviewpro/cli doctor");
		}
	});

	it("follows the voice: no em dashes, no exclamation points outside code", () => {
		const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
		expect(prose).not.toContain("—");
		expect(prose).not.toMatch(/!(?!\[)/);
	});
});
