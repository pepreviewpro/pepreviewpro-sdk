export const AGENTS_START = "<!-- BEGIN:pepreviewpro-agent-rules -->";
export const AGENTS_END = "<!-- END:pepreviewpro-agent-rules -->";

/** Most complete guide first: the Next.js, React, and server guides carry the whole cross-package guide. */
const GUIDES = [
	"@pepreviewpro/next",
	"@pepreviewpro/react",
	"@pepreviewpro/server",
	"@pepreviewpro/browser",
	"@pepreviewpro/core",
	"@pepreviewpro/cli"
];

const guidePath = (name: string) => `\`node_modules/${name}/AGENTS.md\``;

/**
 * The marked block `init` keeps in a project's AGENTS.md, pointing AI coding agents at the guide each installed
 * package ships. `installed` is package names; the block names the most complete guide first.
 */
export function agentsBlock(installed: readonly string[]): string {
	const guides = GUIDES.filter((name) => installed.includes(name));
	const [main, ...others] = guides;
	const body = main
		? [
				`This project uses the PepReviewPro SDK. Before you write or change code that uses it, read ${guidePath(main)}. It says which packages each stack needs, how to do each job, and the rules that keep the store's key secret.`,
				...(others.length > 0 ? ["", `The other PepReviewPro packages here have their own guides: ${others.map(guidePath).join(", ")}.`] : [])
			]
		: [
				"This project is being connected to PepReviewPro, but no PepReviewPro package is installed yet. On Next.js, install `@pepreviewpro/next`, `@pepreviewpro/react`, and `@pepreviewpro/server`. On another React app, install `@pepreviewpro/react` and `@pepreviewpro/server`. On a server alone, install `@pepreviewpro/server`. Then read `node_modules/@pepreviewpro/server/AGENTS.md`, or the Next.js or React one, before you write code."
			];
	return [
		AGENTS_START,
		"",
		"## PepReviewPro",
		"",
		...body,
		"",
		"The paths are relative to this file. In a monorepo, use the node_modules of the app that depends on the package. Run `npx @pepreviewpro/cli doctor` when you finish.",
		"",
		"`npx @pepreviewpro/cli init` writes this block and updates it in place. Keep it between its markers.",
		"",
		AGENTS_END
	].join("\n");
}
