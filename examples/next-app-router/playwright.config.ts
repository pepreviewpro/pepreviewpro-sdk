import { defineConfig } from "@playwright/test";

const REPLAY = "http://127.0.0.1:4010";

export const WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

/** Runs the built app against the SDK's replay server, which answers from the recorded API responses. */
export default defineConfig({
	testDir: "tests",
	fullyParallel: false,
	workers: 1,
	use: { baseURL: "http://127.0.0.1:3100" },
	webServer: [
		{ command: "pnpm --dir ../.. replay --port 4010", url: `${REPLAY}/embed/widgets.js`, reuseExistingServer: false },
		{
			command: "pnpm start",
			url: "http://127.0.0.1:3100/",
			reuseExistingServer: false,
			env: {
				PEPREVIEWPRO_BASE_URL: REPLAY,
				PEPREVIEWPRO_STORE: "magnolia-store",
				PEPREVIEWPRO_API_KEY: `sk_live_${"a".repeat(40)}`,
				PEPREVIEWPRO_WEBHOOK_SECRET: WEBHOOK_SECRET
			}
		}
	]
});
