import { REPOSITORY_URL, REQUIRED_FILES } from "./repository";

export interface PackedManifest {
	name?: string;
	repository?: { type?: string; url?: string; directory?: string } | string;
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
}

const TEST_FILE = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/**
 * What is wrong with a packed tarball, given its entry paths (each under `package/`) and its packed
 * `package.json`. Empty when it can ship: no source maps, no tests or sources, every required file present, no
 * `workspace:` range left behind, and the repository npm checks provenance against.
 */
export function checkTarball(entries: string[], manifest: PackedManifest, folder: string): string[] {
	const files = entries.map((entry) => entry.replace(/^package\//, ""));
	const problems: string[] = [];
	for (const required of REQUIRED_FILES) {
		if (!files.includes(required)) {
			problems.push(`${required} is missing.`);
		}
	}

	for (const file of files) {
		if (file.endsWith(".map")) {
			problems.push(`${file} is a source map. Source maps must not ship.`);
		} else if (TEST_FILE.test(file)) {
			problems.push(`${file} is a test. Tests must not ship.`);
		} else if (file.startsWith("src/")) {
			problems.push(`${file} is source. Only dist ships.`);
		}
	}

	for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
		for (const [name, range] of Object.entries(manifest[field] ?? {})) {
			if (range.startsWith("workspace:")) {
				problems.push(`${field}.${name} is still ${range}. Pack with pnpm, which rewrites it.`);
			}
		}
	}

	const repository = typeof manifest.repository === "string" ? { url: manifest.repository } : (manifest.repository ?? {});
	if (repository.url !== REPOSITORY_URL) {
		problems.push(`repository.url is ${repository.url ?? "missing"}, not ${REPOSITORY_URL}. Trusted publishing and provenance need it exact.`);
	}

	if (repository.directory !== `packages/${folder}`) {
		problems.push(`repository.directory is ${repository.directory ?? "missing"}, not packages/${folder}.`);
	}

	return problems;
}
