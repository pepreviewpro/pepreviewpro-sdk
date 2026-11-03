import type { CliEnv } from "./loadEnv";

/** The store and key every command but `init` needs, or an error that says to run `init`. */
export function requireSetup(env: CliEnv, storeFlag: string | undefined): { store: string; apiKey: string } {
	const store = storeFlag ?? env.store;
	if (!env.apiKey || !store) {
		throw new Error(`Set ${env.apiKey ? "PEPREVIEWPRO_STORE" : "PEPREVIEWPRO_API_KEY"} first. Run \`npx @pepreviewpro/cli init\` to set both.`);
	}

	return { store, apiKey: env.apiKey };
}
