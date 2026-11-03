import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentGuides } from "./agents/buildAgentGuides";
import { listPackages } from "./release/listPackages";

/**
 * Writes every package's AGENTS.md from `docs/agents/`: `pnpm agents`. With `--check`, writes nothing and exits 1
 * when a package's file is out of date, as CI does through `test/agentGuides.test.ts`.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
const guides = buildAgentGuides(
	root,
	listPackages(root).map((pkg) => pkg.folder)
);
let stale = false;
for (const [folder, text] of guides) {
	const path = join(root, "packages", folder, "AGENTS.md");
	let current = "";
	try {
		current = readFileSync(path, "utf8");
	} catch {
		// A package without one yet is simply stale.
	}

	if (current === text) {
		continue;
	}

	stale = true;
	if (check) {
		console.error(`packages/${folder}/AGENTS.md is out of date. Run pnpm agents.`);
	} else {
		writeFileSync(path, text);
		console.log(`Wrote packages/${folder}/AGENTS.md`);
	}
}

if (check && stale) {
	process.exit(1);
}
