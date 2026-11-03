import { existsSync } from "node:fs";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, replayFetch } from "../../../test/replay";
import { AGENTS_END, AGENTS_START, agentsBlock } from "../src/agentsBlock";
import { main } from "../src/main";
import { upsertManagedBlock } from "../src/upsertManagedBlock";
import { project, testIo } from "./helpers";

const env = { PEPREVIEWPRO_API_KEY: fakeKey("sk"), PEPREVIEWPRO_STORE: "example-store" };
const heartbeat = () => replayFetch(fixtureCase("heartbeat", "records the install, dropping capabilities it does not know")).fetch;
const nextApp = JSON.stringify({ dependencies: { "next": "^16.4.2", "@pepreviewpro/next": "^0.1.0", "@pepreviewpro/server": "^0.1.0" } });
const blocks = (text: string) => text.split(AGENTS_START).length - 1;
const upsert = (content: string, block: string) => upsertManagedBlock(content, block, AGENTS_START, AGENTS_END);
const block = (body: string) => `${AGENTS_START}\n${body}\n${AGENTS_END}`;

describe("agentsBlock", () => {
	it("names the most complete installed guide first, by its node_modules path", () => {
		const text = agentsBlock(["@pepreviewpro/server", "@pepreviewpro/next"]);
		expect(text.startsWith(AGENTS_START)).toBe(true);
		expect(text.endsWith(AGENTS_END)).toBe(true);
		expect(text).toContain("read `node_modules/@pepreviewpro/next/AGENTS.md`");
		expect(text).toContain("their own guides: `node_modules/@pepreviewpro/server/AGENTS.md`.");
		expect(text).not.toContain("—");
	});

	it("says what to install when nothing is", () => {
		expect(agentsBlock([])).toContain("no PepReviewPro package is installed yet");
	});
});

describe("upsertManagedBlock", () => {
	it("appends to an empty file, and after a blank line to one with content", () => {
		expect(upsert("", block("a"))).toBe(`${block("a")}\n`);
		expect(upsert("# Rules\n", block("a"))).toBe(`# Rules\n\n${block("a")}\n`);
		expect(upsert("# Rules", block("a"))).toBe(`# Rules\n\n${block("a")}\n`);
	});

	it("replaces the block in place and leaves the rest of the file alone", () => {
		const before = `# Rules\n\n${block("old")}\n\n## Mine\n`;
		expect(upsert(before, block("new"))).toBe(`# Rules\n\n${block("new")}\n\n## Mine\n`);
		expect(upsert(upsert(before, block("new")), block("new"))).toBe(upsert(before, block("new")));
	});

	it("collapses repeated blocks into one", () => {
		const twice = `${block("a")}\n\nmiddle\n\n${block("b")}\n`;
		expect(upsert(twice, block("c"))).toBe(`${block("c")}\n\nmiddle\n`);
	});

	it("keeps CRLF line endings", () => {
		expect(upsert("# Rules\r\n", block("a"))).toBe(`# Rules\r\n\r\n${AGENTS_START}\r\na\r\n${AGENTS_END}\r\n`);
	});

	it("never swallows text after a stray start marker", () => {
		const stray = `${AGENTS_START}\nkeep me\n`;
		const once = upsert(stray, block("a"));
		expect(once).toBe(`${stray}\n${block("a")}\n`);
		expect(upsert(once, block("b"))).toBe(`${stray}\n${block("b")}\n`);
	});
});

describe("init and AGENTS.md", () => {
	it("creates AGENTS.md after a yes, adds the block to CLAUDE.md, and updates both in place when run again", async () => {
		const dir = await project({ "package.json": nextApp, "CLAUDE.md": "# House rules\n" });
		const io = testIo(dir, { env, fetch: heartbeat(), interactive: true, answers: ["n", "y"] });
		expect(await main(["init"], io)).toBe(0);
		const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
		expect(agents).toBe(`${agentsBlock(["@pepreviewpro/next", "@pepreviewpro/server"])}\n`);
		expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe(`# House rules\n\n${agents}`);
		expect(io.lines).toContain("Created the PepReviewPro section in AGENTS.md.");
		const again = testIo(dir, { env, fetch: heartbeat(), interactive: true, answers: ["n", "y"] });
		expect(await main(["init"], again)).toBe(0);
		expect(again.lines).toContain("Already current: the PepReviewPro section in AGENTS.md.");
		expect(blocks(await readFile(join(dir, "AGENTS.md"), "utf8"))).toBe(1);
		expect(blocks(await readFile(join(dir, "CLAUDE.md"), "utf8"))).toBe(1);
	});

	it("rewrites an outdated block between its markers", async () => {
		const dir = await project({ "package.json": nextApp, "AGENTS.md": `# Ours\n\n${block("outdated")}\n\n## Also ours\n` });
		expect(await main(["init", "--yes"], testIo(dir, { env, fetch: heartbeat() }))).toBe(0);
		const text = await readFile(join(dir, "AGENTS.md"), "utf8");
		expect(text).toBe(`# Ours\n\n${agentsBlock(["@pepreviewpro/next", "@pepreviewpro/server"])}\n\n## Also ours\n`);
	});

	it("leaves CLAUDE.md alone when it imports AGENTS.md or is the same file", async () => {
		const importing = await project({ "package.json": nextApp, "CLAUDE.md": "@AGENTS.md\n" });
		const io = testIo(importing, { env, fetch: heartbeat() });
		expect(await main(["init", "--yes"], io)).toBe(0);
		expect(await readFile(join(importing, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
		expect(io.lines).toContain("Left alone: CLAUDE.md, which already reads AGENTS.md.");
		const linked = await project({ "package.json": nextApp, "AGENTS.md": "# Ours\n" });
		await symlink(join(linked, "AGENTS.md"), join(linked, "CLAUDE.md"));
		expect(await main(["init", "-y"], testIo(linked, { env, fetch: heartbeat() }))).toBe(0);
		expect(blocks(await readFile(join(linked, "AGENTS.md"), "utf8"))).toBe(1);
	});

	it("writes nothing with --no-agents, after a no, or without a terminal or --yes", async () => {
		const dir = await project({ "package.json": nextApp });
		expect(await main(["init", "--yes", "--no-agents"], testIo(dir, { env, fetch: heartbeat() }))).toBe(0);
		expect(await main(["init"], testIo(dir, { env, fetch: heartbeat(), interactive: true, answers: ["n", "n"] }))).toBe(0);
		const headless = testIo(dir, { env, fetch: heartbeat() });
		expect(await main(["init"], headless)).toBe(0);
		expect(headless.lines).toContain(
			"AGENTS.md was left alone. Pass --yes to add the PepReviewPro section for AI coding agents, or --no-agents to skip this step."
		);
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
	});

	it("writes .env.local without asking under --yes", async () => {
		const dir = await project({ "package.json": nextApp });
		await writeFile(join(dir, ".gitignore"), ".env*.local\n");
		expect(await main(["init", "--yes", "--no-agents"], testIo(dir, { env, fetch: heartbeat() }))).toBe(0);
		expect(await readFile(join(dir, ".env.local"), "utf8")).toBe(
			`PEPREVIEWPRO_API_KEY=${env.PEPREVIEWPRO_API_KEY}\nPEPREVIEWPRO_STORE=example-store\n`
		);
	});
});
