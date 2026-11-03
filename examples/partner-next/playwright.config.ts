import { defineConfig } from "@playwright/test";

export const REPLAY = "http://127.0.0.1:4011";

/** Runs the built app against the SDK's replay server, which answers from the recorded API responses. */
export default defineConfig({
	testDir: "tests",
	fullyParallel: false,
	workers: 1,
	use: { baseURL: "http://127.0.0.1:3101" },
	webServer: [
		{ command: "pnpm --dir ../.. replay --port 4011", url: `${REPLAY}/embed/widgets.js`, reuseExistingServer: false },
		{
			command: "pnpm start",
			url: "http://127.0.0.1:3101/",
			reuseExistingServer: false,
			env: { PEPREVIEWPRO_BASE_URL: REPLAY, PEPREVIEWPRO_API_KEY: `pk_live_${"a".repeat(40)}`, EXAMPLE_SCRIPTED_MODEL: "1" }
		}
	]
});
