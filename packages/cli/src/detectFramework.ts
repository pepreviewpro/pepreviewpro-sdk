import { readPackageVersions } from "./readPackageVersions";

/** Checked in order, so a meta-framework wins over the React or Express it is built on. */
const FRAMEWORKS = ["next", "@remix-run/react", "@react-router/dev", "@tanstack/react-start", "astro", "nuxt", "@sveltejs/kit", "express", "react"];

/** Like `next@16.4.2`, from the project's dependencies, for the heartbeat. `unknown` when none is found. */
export async function detectFramework(cwd: string): Promise<string> {
	const versions = await readPackageVersions(cwd, FRAMEWORKS);
	const name = FRAMEWORKS.find((framework) => versions[framework]);
	return name ? `${name}@${versions[name]}` : "unknown";
}
