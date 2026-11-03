import { PepReviewProApiError } from "@pepreviewpro/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { agentsBlock } from "../agentsBlock";
import { createSdk } from "../createSdk";
import { detectFramework } from "../detectFramework";
import type { Io } from "../io";
import { keyKind } from "../keyKind";
import { loadEnv } from "../loadEnv";
import { readPackageVersions } from "../readPackageVersions";
import { SDK_PACKAGES } from "../sdkPackages";
import { upsertEnvLines } from "../upsertEnvLines";
import { writeAgentPointers, type PointerResult } from "../writeAgentPointers";

const ENV_FILE = ".env.local";

async function readText(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return "";
	}
}

/** Whether `.gitignore` names `.env.local` or a pattern that covers it. */
async function isIgnored(cwd: string): Promise<boolean> {
	const lines = (await readText(join(cwd, ".gitignore"))).split(/\r?\n/).map((line) => line.trim());
	return lines.some((line) => [".env.local", ".env*", ".env*.local", "*.local", ".env.*"].includes(line));
}

export interface InitFlags {
	store?: string | undefined;
	/** Answers yes to every question, so `init` can run without a terminal. */
	yes?: boolean | undefined;
	/** Leaves AGENTS.md and CLAUDE.md alone. */
	noAgents?: boolean | undefined;
}

const POINTER_WORDS: Record<PointerResult, string> = {
	created: "Created",
	updated: "Updated",
	unchanged: "Already current:",
	skipped: "Left alone:"
};

/** Asks before adding the block that points AI coding agents at the installed packages' AGENTS.md guides. */
async function offerAgentPointers(io: Io, flags: InitFlags, installed: string[]): Promise<void> {
	if (flags.noAgents) {
		return;
	}

	const question = "Add a PepReviewPro section to AGENTS.md, and to CLAUDE.md if you have one, so AI coding agents read the SDK's guide first? (y/N) ";
	if (!flags.yes && !io.interactive) {
		io.out("AGENTS.md was left alone. Pass --yes to add the PepReviewPro section for AI coding agents, or --no-agents to skip this step.");
		return;
	}

	if (!flags.yes && !(await io.prompt.confirm(question))) {
		return;
	}

	const { agents, claude } = await writeAgentPointers(io.cwd, agentsBlock(installed));
	io.out(`${POINTER_WORDS[agents]} the PepReviewPro section in AGENTS.md.`);
	if (claude === "skipped") {
		io.out("Left alone: CLAUDE.md, which already reads AGENTS.md.");
	} else if (claude) {
		io.out(`${POINTER_WORDS[claude]} the PepReviewPro section in CLAUDE.md.`);
	}
}

/**
 * Sets up a store: takes the key, checks it by sending a heartbeat, and with the user's yes writes the key and
 * the store to `.env.local`, then offers to point AI coding agents at the SDK's guides. Never writes without a yes,
 * asked or given as `--yes`.
 */
export async function init(io: Io, flags: InitFlags): Promise<number> {
	const env = await loadEnv(io);
	let apiKey = env.apiKey;
	if (!apiKey) {
		if (!io.interactive) {
			io.err("Set PEPREVIEWPRO_API_KEY, or run init in a terminal to paste the key.");
			return 1;
		}

		apiKey = await io.prompt.askSecret("Paste your PepReviewPro key (secret, server only): ");
	}

	const kind = keyKind(apiKey);
	if (!kind) {
		io.err("That is not a PepReviewPro key. A key is sk_live_ or pk_live_ and 40 letters and digits.");
		return 1;
	}

	let store = flags.store ?? env.store;
	if (!store) {
		if (!io.interactive) {
			io.err("Pass --store with the store's slug, or set PEPREVIEWPRO_STORE.");
			return 1;
		}

		store = await io.prompt.ask("Your store's slug, as in pepreviewpro.com/vendors/<slug>: ");
	}

	io.out(`Checking the key for ${store}...`);
	const packages = await readPackageVersions(io.cwd, SDK_PACKAGES);
	try {
		const { receivedAt } = await createSdk(io, env, store, apiKey).heartbeat({ framework: await detectFramework(io.cwd), packages });
		io.out(`The key works. PepReviewPro heard from this store at ${receivedAt}.`);
	} catch (error) {
		io.err(
			error instanceof PepReviewProApiError ? `The key was refused: ${error.message}` : `Could not reach PepReviewPro: ${(error as Error).message}`
		);
		return 1;
	}

	if (kind === "owner") {
		io.out("This is an owner key (pk_live_). It counts toward your account's 10,000 requests a month. A store key (sk_live_) has no monthly cap.");
	}

	io.out("");
	io.out("This key is secret. Keep it on the server. Never put it in browser code or in a NEXT_PUBLIC_ variable.");
	io.out("");
	const path = join(io.cwd, ENV_FILE);
	const current = await readText(path);
	const vars = { PEPREVIEWPRO_API_KEY: apiKey, PEPREVIEWPRO_STORE: store };
	const updated = upsertEnvLines(current, vars);
	if (updated === current) {
		io.out(`${ENV_FILE} already has both values.`);
	} else if (flags.yes || (io.interactive && (await io.prompt.confirm(`Write PEPREVIEWPRO_API_KEY and PEPREVIEWPRO_STORE to ${ENV_FILE}? (y/N) `)))) {
		await writeFile(path, updated, { mode: 0o600 });
		io.out(`Saved to ${ENV_FILE}.`);
	} else {
		io.out(`Nothing was written. Add these to ${ENV_FILE} and to your host's server environment:`);
		io.out("PEPREVIEWPRO_API_KEY=<your key>");
		io.out(`PEPREVIEWPRO_STORE=${store}`);
	}

	if (!(await isIgnored(io.cwd))) {
		io.out(`Add ${ENV_FILE} to .gitignore so the key is never committed.`);
	}

	await offerAgentPointers(io, flags, [...Object.keys(packages), ...Object.keys(await readPackageVersions(io.cwd, ["@pepreviewpro/cli"]))]);
	io.out("Next: run `npx @pepreviewpro/cli doctor` to check every part.");
	return 0;
}
