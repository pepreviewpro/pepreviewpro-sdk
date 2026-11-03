import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { listPackages } from "./release/listPackages";
import { extractSnippets, PARTIAL_MARKER } from "./snippets/extractSnippets";

/**
 * Type-checks every TypeScript and TSX sample in the READMEs, the agent guides, and the docs against the built
 * packages, resolved through their `exports` the way a store's project resolves them: `pnpm build`, then
 * `pnpm docs:snippets`. Samples call the store's own code through the stand-ins in `snippets/storeCode.d.ts`. A
 * sample that cannot stand alone gets `<!-- snippet: partial -->` on the line above its fence.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const workDir = join(root, ".snippets");
const markdownFiles = [
	"README.md",
	"AGENTS.md",
	"RELEASING.md",
	...readdirSync(join(root, "docs"))
		.filter((file) => file.endsWith(".md"))
		.map((file) => `docs/${file}`),
	...readdirSync(join(root, "docs/guides")).map((file) => `docs/guides/${file}`),
	...readdirSync(join(root, "packages")).flatMap((folder) => [`packages/${folder}/README.md`, `packages/${folder}/AGENTS.md`]),
	...readdirSync(join(root, "examples")).map((folder) => `examples/${folder}/README.md`)
].filter((file) => file.endsWith(".md") && existsSync(join(root, file)));

rmSync(workDir, { recursive: true, force: true });
mkdirSync(join(workDir, "node_modules", "@pepreviewpro"), { recursive: true });
for (const pkg of listPackages(root)) {
	if (!existsSync(join(pkg.dir, "dist"))) {
		console.error(`${pkg.name} is not built. Run pnpm build first.`);
		process.exit(1);
	}

	symlinkSync(pkg.dir, join(workDir, "node_modules", "@pepreviewpro", pkg.folder), "dir");
}

/** Frameworks only the examples install, like `react-router` and `express`, so samples for those stacks check too. */
for (const example of readdirSync(join(root, "examples"))) {
	const modules = join(root, "examples", example, "node_modules");
	if (!existsSync(modules)) {
		continue;
	}

	for (const entry of readdirSync(modules)) {
		const names = entry.startsWith("@") ? readdirSync(join(modules, entry)).map((name) => `${entry}/${name}`) : [entry];
		for (const name of names) {
			const link = join(workDir, "node_modules", name);
			if (name.startsWith("@pepreviewpro/") || name.startsWith(".") || existsSync(link) || existsSync(join(root, "node_modules", name))) {
				continue;
			}

			mkdirSync(dirname(link), { recursive: true });
			symlinkSync(realpathSync(join(modules, name)), link, "dir");
		}
	}
}

const storeCode = join(workDir, "storeCode.d.ts");
copyFileSync(join(root, "scripts/snippets/storeCode.d.ts"), storeCode);
const sources = new Map<string, { file: string; line: number }>();
const seen = new Map<string, string>();
let total = 0;
for (const file of markdownFiles) {
	for (const snippet of extractSnippets(readFileSync(join(root, file), "utf8"))) {
		total++;
		if (seen.has(snippet.code)) {
			continue;
		}

		const name = `${file.replace(/[^\w]+/g, "_")}_${snippet.line}.${snippet.language}`;
		const path = join(workDir, name);
		writeFileSync(path, `${snippet.code}\nexport {};\n`);
		sources.set(path, { file, line: snippet.line });
		seen.set(snippet.code, path);
	}
}

const program = ts.createProgram([storeCode, ...sources.keys()], {
	target: ts.ScriptTarget.ES2022,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	jsx: ts.JsxEmit.ReactJSX,
	lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
	types: ["node"],
	strict: true,
	skipLibCheck: true,
	noEmit: true
});
const problems = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
	const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
	if (!diagnostic.file || diagnostic.start === undefined) {
		return message;
	}

	const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
	const source = sources.get(diagnostic.file.fileName);
	return source ? `${source.file}:${source.line + line}  ${message}` : `${relative(root, diagnostic.file.fileName)}:${line + 1}  ${message}`;
});
if (problems.length > 0) {
	console.error(problems.join("\n"));
	console.error(
		`\n${problems.length} problems in the docs' code samples. Fix the sample, or mark one that cannot stand alone with ${PARTIAL_MARKER}.`
	);
	process.exit(1);
}

console.log(`Checked ${total} code samples in ${markdownFiles.length} files (${sources.size} distinct) against the built packages.`);
