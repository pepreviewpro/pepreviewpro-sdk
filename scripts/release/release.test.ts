import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkTarball } from "./checkTarball";
import { listPackages } from "./listPackages";
import { meetsVersion } from "./meetsVersion";
import { REPOSITORY_URL } from "./repository";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifest = { repository: { type: "git", url: REPOSITORY_URL, directory: "packages/server" }, dependencies: { "@pepreviewpro/core": "0.1.0" } };
const shipped = [
	"package/package.json",
	"package/README.md",
	"package/AGENTS.md",
	"package/LICENSE",
	"package/dist/index.js",
	"package/dist/index.d.ts"
];

describe("checkTarball", () => {
	it("passes a tarball with the docs, the license, and only built code", () => {
		expect(checkTarball(shipped, manifest, "server")).toEqual([]);
	});

	it("refuses source maps, tests, sources, and missing docs", () => {
		const entries = [
			...shipped.filter((entry) => !entry.endsWith("AGENTS.md")),
			"package/dist/index.js.map",
			"package/test/orders.test.ts",
			"package/src/index.ts"
		];
		expect(checkTarball(entries, manifest, "server")).toEqual([
			"AGENTS.md is missing.",
			"dist/index.js.map is a source map. Source maps must not ship.",
			"test/orders.test.ts is a test. Tests must not ship.",
			"src/index.ts is source. Only dist ships."
		]);
	});

	it("refuses a workspace range and a repository npm would not match", () => {
		expect(
			checkTarball(shipped, { repository: "https://github.com/someone/else", dependencies: { "@pepreviewpro/core": "workspace:*" } }, "server")
		).toEqual([
			"dependencies.@pepreviewpro/core is still workspace:*. Pack with pnpm, which rewrites it.",
			`repository.url is https://github.com/someone/else, not ${REPOSITORY_URL}. Trusted publishing and provenance need it exact.`,
			"repository.directory is missing, not packages/server."
		]);
	});
});

describe("listPackages", () => {
	it("lists every package with its dependencies first", () => {
		const names = listPackages(root).map((pkg) => pkg.name);
		expect([...names].sort()).toEqual([
			"@pepreviewpro/ai",
			"@pepreviewpro/browser",
			"@pepreviewpro/cli",
			"@pepreviewpro/core",
			"@pepreviewpro/next",
			"@pepreviewpro/react",
			"@pepreviewpro/server"
		]);
		for (const pkg of listPackages(root)) {
			for (const dependency of pkg.dependencies) {
				expect(names.indexOf(dependency)).toBeLessThan(names.indexOf(pkg.name));
			}
		}
	});
});

describe("meetsVersion", () => {
	it("compares dotted versions", () => {
		expect(meetsVersion("11.5.1", "11.5.1")).toBe(true);
		expect(meetsVersion("11.10.0", "11.5.1")).toBe(true);
		expect(meetsVersion("12.0.0-pre", "11.5.1")).toBe(true);
		expect(meetsVersion("11.5.0", "11.5.1")).toBe(false);
		expect(meetsVersion("10.9.2", "11.5.1")).toBe(false);
	});
});
