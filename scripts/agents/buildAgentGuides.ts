import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The packages whose guide carries the whole cross-package guide. The rest point to these by node_modules path. */
const FULL_GUIDE = new Set(["next", "react", "server"]);

/** Packages a directory partner installs. They carry the partner guide, after the store guide when they have it. */
const PARTNER_GUIDE = new Set(["ai", "next", "server"]);

/** Packages only directory partners install. They close with the partner guide alone, since a store's recipes do not apply. */
export const PARTNER_PACKAGES = new Set(["ai"]);

/**
 * Each package's AGENTS.md, by folder name, built from `docs/agents/`: the package's own file, then the shared store
 * guide for `next`, `react`, and `server`, then the partner guide for the packages partners install. A package with
 * neither points to them. Shared text lives once, there.
 */
export function buildAgentGuides(root: string, folders: string[]): Map<string, string> {
	const read = (name: string) => readFileSync(join(root, "docs", "agents", `${name}.md`), "utf8").trim();
	const closing = (folder: string) => {
		const parts = [...(FULL_GUIDE.has(folder) ? ["guide"] : []), ...(PARTNER_GUIDE.has(folder) ? ["partner"] : [])];
		return (parts.length > 0 ? parts : ["pointer"]).map(read).join("\n\n");
	};

	return new Map(folders.map((folder) => [folder, `${read(folder)}\n\n${closing(folder)}\n`]));
}
