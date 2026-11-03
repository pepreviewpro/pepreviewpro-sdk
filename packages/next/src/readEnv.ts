export interface NextEnv {
	store: string | undefined;
	webhookSecret: string | undefined;
}

/**
 * The environment variables this package reads, each by its literal name: Next.js inlines env vars by matching the
 * exact text `process.env.NAME`, so a dynamic lookup would come back empty.
 */
export function readEnv(): NextEnv {
	return {
		store: process.env.PEPREVIEWPRO_STORE || undefined,
		webhookSecret: process.env.PEPREVIEWPRO_WEBHOOK_SECRET || undefined
	};
}
