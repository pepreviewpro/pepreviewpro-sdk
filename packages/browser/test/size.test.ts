import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const BUDGET = 3 * 1024;

describe("bundle size", () => {
	it("stays under 3 kB gzipped, minified, with everything it exports", async () => {
		const result = await build({
			entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
			bundle: true,
			minify: true,
			format: "esm",
			platform: "browser",
			write: false
		});
		const bytes = gzipSync(result.outputFiles[0]?.contents ?? new Uint8Array()).byteLength;
		expect(bytes).toBeGreaterThan(0);
		expect(bytes).toBeLessThan(BUDGET);
	});

	it("has no dependencies", async () => {
		const manifest = (await import("../package.json", { with: { type: "json" } })).default as Record<string, unknown>;
		expect(manifest["dependencies"] ?? {}).toEqual({});
		expect(manifest["peerDependencies"] ?? {}).toEqual({});
	});
});
