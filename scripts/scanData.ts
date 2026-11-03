import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCAN_EXCEPTIONS } from "./data/dataPolicy";
import { findRealData } from "./data/findRealData";

/**
 * Fails when any file git would commit holds data that could be real: `pnpm scan:data`. It reads every tracked and
 * untracked file that .gitignore does not exclude, dotfiles included. Locally, `PEPREVIEWPRO_SCAN_VERBOSE=1` prints
 * whole matches.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
// An exception is listed in the policy file, so it is allowed there too.
const POLICY = "scripts/data/dataPolicy.ts";

const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
	.split("\0")
	.filter(Boolean);
let total = 0;
for (const file of files) {
	const path = join(ROOT, file);
	if (!existsSync(path)) {
		continue;
	}

	const bytes = readFileSync(path);
	if (bytes.includes(0)) {
		continue;
	}

	const findings = findRealData(bytes.toString("utf8"), { verbose: process.env["PEPREVIEWPRO_SCAN_VERBOSE"] === "1" });
	for (const finding of findings.filter(
		({ match }) => !SCAN_EXCEPTIONS.some((allowed) => (allowed.file === file || file === POLICY) && allowed.match === match)
	)) {
		total++;
		console.error(`${file}:${finding.line.toString()}  ${finding.rule}  (${finding.excerpt})`);
	}
}

console.log(
	total === 0
		? `No real data in ${files.length.toString()} files.`
		: `${total.toString()} findings. Replace them with the fictional values in scripts/data/dataPolicy.ts, or allow them there with a reason.`
);
process.exitCode = total === 0 ? 0 : 1;
