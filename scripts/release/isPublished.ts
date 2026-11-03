import { spawnSync } from "node:child_process";

/** Whether `name@version` is already on npm. A package npm has never seen is simply not published. */
export function isPublished(name: string, version: string): boolean {
	const result = spawnSync("npm", ["view", `${name}@${version}`, "version", "--json"], { encoding: "utf8" });
	if (result.status === 0) {
		return result.stdout.trim() !== "";
	}

	if (/E404|404 Not Found/.test(`${result.stdout}${result.stderr}`)) {
		return false;
	}

	throw new Error(`npm view ${name}@${version} failed: ${result.stderr.trim() || result.stdout.trim()}`);
}
