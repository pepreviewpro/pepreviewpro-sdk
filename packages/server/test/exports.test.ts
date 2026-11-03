import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package exports", () => {
	it("maps the browser condition to the guard, after every server runtime's condition", () => {
		const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { exports: { ".": Record<string, string> } };
		const conditions = Object.keys(manifest.exports["."]);
		expect(manifest.exports["."]["browser"]).toBe("./dist/browserGuard.js");
		for (const server of ["react-server", "edge-light", "workerd", "worker", "node"]) {
			expect(conditions.indexOf(server)).toBeLessThan(conditions.indexOf("browser"));
		}
	});
});
