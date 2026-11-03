export interface SdkEnv {
	apiKey: string | undefined;
	webhookSecret: string | undefined;
	baseUrl: string | undefined;
	nextRuntime: string | undefined;
}

/**
 * The environment variables the server package reads, each by its literal name: bundlers that inline env vars
 * match the exact text `process.env.NAME`, so a dynamic lookup would come back empty.
 */
export function readEnv(): SdkEnv {
	if (typeof process === "undefined" || !process.env) {
		return { apiKey: undefined, webhookSecret: undefined, baseUrl: undefined, nextRuntime: undefined };
	}

	return {
		apiKey: process.env.PEPREVIEWPRO_API_KEY,
		webhookSecret: process.env.PEPREVIEWPRO_WEBHOOK_SECRET,
		baseUrl: process.env.PEPREVIEWPRO_BASE_URL || undefined,
		nextRuntime: process.env.NEXT_RUNTIME
	};
}
