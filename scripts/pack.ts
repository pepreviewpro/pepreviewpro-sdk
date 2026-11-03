import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { listPackages } from "./release/listPackages";
import { packPackage } from "./release/packPackage";

/**
 * Packs every package the way a release does and checks each tarball, without publishing: `pnpm pack:check`.
 * Build first. Prints each tarball's files so a review can see exactly what npm would get. `--out <dir>` keeps the
 * tarballs there, for the one-time bootstrap publish in RELEASING.md.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const { values } = parseArgs({ options: { out: { type: "string" } } });
const outDir = values.out ? resolve(values.out) : undefined;
if (outDir) {
	mkdirSync(outDir, { recursive: true });
}

let failed = false;
for (const pkg of listPackages(root)) {
	const { tarball, entries, problems } = packPackage(pkg, outDir);
	console.log(`\n${pkg.name}@${pkg.version}  ${tarball}`);
	for (const entry of entries) {
		console.log(`  ${entry.replace(/^package\//, "")}`);
	}

	for (const problem of problems) {
		console.error(`  problem: ${problem}`);
	}

	failed ||= problems.length > 0;
}

if (failed) {
	console.error("\nA tarball is not fit to publish.");
	process.exit(1);
}

console.log("\nEvery tarball is fit to publish.");
