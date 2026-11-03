import { readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENTS_END, AGENTS_START } from "./agentsBlock";
import { upsertManagedBlock } from "./upsertManagedBlock";

export type PointerResult = "created" | "updated" | "unchanged" | "skipped";

async function readText(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return null;
	}
}

async function samePath(a: string, b: string): Promise<boolean> {
	try {
		return (await realpath(a)) === (await realpath(b));
	} catch {
		return false;
	}
}

async function upsertFile(path: string, current: string, block: string): Promise<PointerResult> {
	const updated = upsertManagedBlock(current, block, AGENTS_START, AGENTS_END);
	if (updated === current) {
		return "unchanged";
	}

	await writeFile(path, updated);
	return "updated";
}

/**
 * Puts `block` in the project's AGENTS.md, creating the file when it is missing, and in CLAUDE.md when one exists.
 * CLAUDE.md is skipped when it is AGENTS.md under another name or already imports it with `@AGENTS.md`, since its
 * readers would then see the block twice.
 */
export async function writeAgentPointers(cwd: string, block: string): Promise<{ agents: PointerResult; claude: PointerResult | null }> {
	const agentsPath = join(cwd, "AGENTS.md");
	const claudePath = join(cwd, "CLAUDE.md");
	const agentsText = await readText(agentsPath);
	let agents: PointerResult;
	if (agentsText === null) {
		await writeFile(agentsPath, `${block}\n`);
		agents = "created";
	} else {
		agents = await upsertFile(agentsPath, agentsText, block);
	}

	const claudeText = await readText(claudePath);
	if (claudeText === null) {
		return { agents, claude: null };
	}

	if ((await samePath(agentsPath, claudePath)) || /^\s*@(\.\/)?AGENTS\.md\s*$/m.test(claudeText)) {
		return { agents, claude: "skipped" };
	}

	return { agents, claude: await upsertFile(claudePath, claudeText, block) };
}
