import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkTarball, type PackedManifest } from "./checkTarball";
import type { WorkspacePackage } from "./listPackages";

export interface PackedPackage {
	tarball: string;
	entries: string[];
	problems: string[];
}

/**
 * Packs one package with pnpm, which rewrites `workspace:*` to real versions, into `outDir` or a fresh temp
 * folder, and checks the tarball. `npm publish` takes the result as is.
 */
export function packPackage(pkg: WorkspacePackage, outDir?: string): PackedPackage {
	const destination = mkdtempSync(join(outDir ?? tmpdir(), "pepreviewpro-pack-"));
	execFileSync("pnpm", ["pack", "--pack-destination", destination], { cwd: pkg.dir, stdio: ["ignore", "ignore", "inherit"] });
	const name = readdirSync(destination).find((file) => file.endsWith(".tgz"));
	if (!name) {
		throw new Error(`pnpm pack wrote no tarball for ${pkg.name}.`);
	}

	const tarball = join(destination, name);
	const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
	const manifest = JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" })) as PackedManifest;
	return { tarball, entries, problems: checkTarball(entries, manifest, pkg.folder) };
}
