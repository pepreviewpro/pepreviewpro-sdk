import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface WorkspacePackage {
	name: string;
	version: string;
	dir: string;
	/** The package's own name for its folder, like `server`. */
	folder: string;
	dependencies: string[];
}

/**
 * Every publishable package under `packages/`, dependencies before dependents, so a release never publishes a
 * package before the sibling version it depends on.
 */
export function listPackages(root: string): WorkspacePackage[] {
	const found = readdirSync(join(root, "packages"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const dir = join(root, "packages", entry.name);
			const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
				name: string;
				version: string;
				private?: boolean;
				dependencies?: Record<string, string>;
			};
			return { manifest, dir, folder: entry.name };
		})
		.filter(({ manifest }) => !manifest.private)
		.map(({ manifest, dir, folder }) => ({
			name: manifest.name,
			version: manifest.version,
			dir,
			folder,
			dependencies: Object.keys(manifest.dependencies ?? {})
		}));
	const ordered: WorkspacePackage[] = [];
	const visit = (pkg: WorkspacePackage, path: string[]) => {
		if (ordered.includes(pkg)) {
			return;
		}

		if (path.includes(pkg.name)) {
			throw new Error(`Dependency cycle: ${[...path, pkg.name].join(" -> ")}`);
		}

		for (const dependency of pkg.dependencies) {
			const sibling = found.find((candidate) => candidate.name === dependency);
			if (sibling) {
				visit(sibling, [...path, pkg.name]);
			}
		}

		ordered.push(pkg);
	};

	for (const pkg of [...found].sort((a, b) => a.name.localeCompare(b.name))) {
		visit(pkg, []);
	}

	return ordered;
}
