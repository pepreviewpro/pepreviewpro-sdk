import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isPublished } from "./release/isPublished";
import { listPackages } from "./release/listPackages";
import { meetsVersion } from "./release/meetsVersion";
import { packPackage } from "./release/packPackage";

/**
 * The release workflow's two steps. `status` says whether any package's version is missing from npm, as a
 * `pending` step output. `publish` packs and checks every such package, publishes it with `npm publish` over
 * trusted publishing (OIDC, no token), tags it, and prints the `New tag:` lines changesets/action turns into
 * GitHub releases. Both are safe to run on every push: a version already on npm is skipped.
 */
const MIN_NPM = "11.5.1";
const root = fileURLToPath(new URL("..", import.meta.url));
const command = process.argv[2];
const pending = listPackages(root).filter((pkg) => !isPublished(pkg.name, pkg.version));
if (command === "status") {
	console.log(pending.length === 0 ? "Every version is on npm." : `Not on npm yet: ${pending.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ")}`);
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `pending=${pending.length > 0}\n`);
	}
} else if (command === "publish") {
	if (pending.length === 0) {
		console.log("Every version is on npm. Nothing to publish.");
		process.exit(0);
	}

	const npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
	if (!meetsVersion(npmVersion, MIN_NPM)) {
		throw new Error(`Trusted publishing needs npm ${MIN_NPM} or later. This is npm ${npmVersion}.`);
	}

	const packed = pending.map((pkg) => ({ pkg, ...packPackage(pkg) }));
	const problems = packed.flatMap(({ pkg, problems: found }) => found.map((problem) => `${pkg.name}: ${problem}`));
	if (problems.length > 0) {
		throw new Error(`Nothing was published.\n${problems.join("\n")}`);
	}

	for (const { pkg, tarball } of packed) {
		execFileSync("npm", ["publish", tarball, "--access", "public", "--provenance"], { stdio: "inherit" });
		execFileSync("git", ["tag", `${pkg.name}@${pkg.version}`], { cwd: root, stdio: "inherit" });
		console.log(`New tag: ${pkg.name}@${pkg.version}`);
	}
} else {
	console.error("Usage: tsx scripts/release.ts <status|publish>");
	process.exit(2);
}
