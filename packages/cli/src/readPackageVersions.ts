import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readJson(path: string): Promise<Record<string, unknown> | null> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/** The installed version of each package in `names` under `cwd`, falling back to the range in package.json. */
export async function readPackageVersions(cwd: string, names: readonly string[]): Promise<Record<string, string>> {
	const manifest = await readJson(join(cwd, "package.json"));
	const declared = { ...(manifest?.["devDependencies"] as object), ...(manifest?.["dependencies"] as object) } as Record<string, string>;
	const versions: Record<string, string> = {};
	for (const name of names) {
		const installed = (await readJson(join(cwd, "node_modules", name, "package.json")))?.["version"];
		const version = typeof installed === "string" ? installed : declared[name]?.replace(/^[^\d]*/, "");
		if (version) {
			versions[name] = version;
		}
	}

	return versions;
}
