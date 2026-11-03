import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Io } from "./io";
import { parseDotenv } from "./parseDotenv";

export interface CliEnv {
	apiKey: string | undefined;
	store: string | undefined;
	baseUrl: string | undefined;
	webhookSecret: string | undefined;
	/** Every variable from `.env` and `.env.local`, to look for keys under the wrong name. */
	fileVars: Record<string, string>;
}

async function readEnvFile(path: string): Promise<Record<string, string>> {
	try {
		return parseDotenv(await readFile(path, "utf8"));
	} catch {
		return {};
	}
}

/** The SDK's variables from the shell, then `.env.local`, then `.env`, the order Next.js and Vite read them in. */
export async function loadEnv(io: Io): Promise<CliEnv> {
	const fileVars = { ...(await readEnvFile(join(io.cwd, ".env"))), ...(await readEnvFile(join(io.cwd, ".env.local"))) };
	const read = (name: string) => io.env[name] || fileVars[name] || undefined;
	return {
		apiKey: read("PEPREVIEWPRO_API_KEY"),
		store: read("PEPREVIEWPRO_STORE"),
		baseUrl: read("PEPREVIEWPRO_BASE_URL"),
		webhookSecret: read("PEPREVIEWPRO_WEBHOOK_SECRET"),
		fileVars
	};
}
