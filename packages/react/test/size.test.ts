import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const BUDGET = 15 * 1024;

describe("bundle size", () => {
	it("stays under 15 kB gzipped with core and browser, without React and the widget runtime", async () => {
		const result = await build({
			entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
			bundle: true,
			minify: true,
			format: "esm",
			platform: "browser",
			jsx: "automatic",
			external: ["react", "react-dom", "react/jsx-runtime"],
			define: { __PACKAGE_VERSION__: '"0.0.0"' },
			alias: {
				"@pepreviewpro/core": fileURLToPath(new URL("../../core/src/index.ts", import.meta.url)),
				"@pepreviewpro/browser": fileURLToPath(new URL("../../browser/src/index.ts", import.meta.url))
			},
			write: false
		});
		const bytes = gzipSync(result.outputFiles[0]?.contents ?? new Uint8Array()).byteLength;
		expect(bytes).toBeGreaterThan(0);
		expect(bytes).toBeLessThan(BUDGET);
	});
});
