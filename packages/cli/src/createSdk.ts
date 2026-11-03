import { PepReviewPro } from "@pepreviewpro/server";
import type { Io } from "./io";
import type { CliEnv } from "./loadEnv";

/** The server client for a command. The CLI sends its own heartbeat from `init`, so the automatic one is off. */
export function createSdk(io: Io, env: CliEnv, store: string, apiKey: string | undefined = env.apiKey): PepReviewPro {
	return new PepReviewPro({
		store,
		apiKey,
		heartbeat: false,
		...(env.baseUrl ? { baseUrl: env.baseUrl } : {}),
		...(io.fetch ? { fetch: io.fetch } : {})
	});
}
