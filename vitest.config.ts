import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
const entry = (name: string) => fileURLToPath(new URL(`./packages/next/src/entries/${name}.ts`, import.meta.url));

export default defineConfig({
	define: { __PACKAGE_VERSION__: JSON.stringify("0.0.0-test") },
	resolve: {
		alias: {
			"@pepreviewpro/core": source("core"),
			"@pepreviewpro/server": source("server"),
			"@pepreviewpro/browser": source("browser"),
			"@pepreviewpro/react": source("react"),
			"@pepreviewpro/next/webhooks": entry("webhooks"),
			"@pepreviewpro/next/proxy": entry("proxy"),
			"@pepreviewpro/next/cache-components": entry("cache-components"),
			"@pepreviewpro/next": source("next"),
			"@pepreviewpro/ai": source("ai")
		}
	},
	test: {
		include: ["packages/*/test/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "test/**/*.test.ts", "examples/*/test/**/*.test.ts"],
		environment: "node",
		environmentOptions: { jsdom: { url: "https://store.example/" } },
		restoreMocks: true,
		unstubEnvs: true,
		unstubGlobals: true
	}
});
