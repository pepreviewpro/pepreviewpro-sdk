import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Io } from "../src/io";

export interface TestIo extends Io {
	lines: string[];
	errors: string[];
	answers: string[];
}

/** A project directory under the OS temp dir, with `files` written into it. */
export async function project(files: Record<string, string> = {}): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pepreviewpro-cli-"));
	for (const [name, content] of Object.entries(files)) {
		await writeFile(join(dir, name), content);
	}

	return dir;
}

/** An `Io` that records output and answers prompts from `answers` in order. */
export function testIo(cwd: string, overrides: Partial<Io> & { answers?: string[] } = {}): TestIo {
	const lines: string[] = [];
	const errors: string[] = [];
	const answers = overrides.answers ?? [];
	const next = async () => answers.shift() ?? "";
	return {
		cwd,
		env: {},
		out: (line) => lines.push(line),
		err: (line) => errors.push(line),
		interactive: false,
		prompt: { ask: next, askSecret: next, confirm: async () => /^y/i.test(await next()) },
		readStdin: async () => "",
		now: () => Date.parse("2026-11-02T16:00:00Z"),
		...overrides,
		lines,
		errors,
		answers
	};
}
