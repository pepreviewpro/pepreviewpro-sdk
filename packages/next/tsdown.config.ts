import { defineConfig } from "tsdown";
import { packageConfig } from "../../tsdown.shared.ts";

export default defineConfig(
	packageConfig(import.meta.dirname, {
		entry: {
			"index": "src/index.ts",
			"cache-components": "src/entries/cache-components.ts",
			"webhooks": "src/entries/webhooks.ts",
			"proxy": "src/entries/proxy.ts"
		},
		platform: "neutral"
	})
);
