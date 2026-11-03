import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { format, getFileInfo, resolveConfig } from "prettier";
import { FIXTURE_ENDPOINTS } from "../test/replay";
import { anonymizeFixtures } from "./data/anonymizeFixtures";
import { findRealData } from "./data/findRealData";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURES = join(ROOT, "test", "fixtures");

/**
 * Copies the app's contract recordings, and optionally its `apiEndpoints` export, into the SDK's fixtures, and
 * anonymises them on the way in: `pnpm sync-fixtures --app <app checkout> [--endpoints apiEndpoints.json]`. The app
 * path can also come from `PEPREVIEWPRO_APP_DIR`. The SDK's own fixtures go through the same pass, so a store or id
 * gets one pseudonym everywhere. `--local` skips the app and runs the fixtures already here through that pass again.
 * `--terms <file>` adds `{ "real": "fictional" }` replacements for prose no field names; keep that file outside this
 * repository. Nothing is written if the result still fails `pnpm scan:data`.
 */
const { values } = parseArgs({
	options: { app: { type: "string" }, local: { type: "boolean" }, endpoints: { type: "string" }, terms: { type: "string" } }
});
const appDir = values.app ?? process.env["PEPREVIEWPRO_APP_DIR"];
if (!appDir && !values.local) {
	console.error("Usage: pnpm sync-fixtures --app <path to the app checkout> | --local [--endpoints apiEndpoints.json] [--terms terms.json]");
	process.exit(2);
}

const source = appDir && !values.local ? join(appDir, "tests", "contracts", "api", "fixtures") : join(FIXTURES, "api");
if (!existsSync(source)) {
	throw new Error(`${source} does not exist. Pass the root of the app checkout.`);
}

if (values.endpoints && !existsSync(values.endpoints)) {
	throw new Error(`${values.endpoints} does not exist.`);
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;
const contractFiles = readdirSync(join(FIXTURES, "contract")).filter((file) => file.endsWith(".json"));
/** Every recording the tests or the replay server read, so naming one in `test/replay.ts` is enough to bring it in. */
const wanted = new Set([...readdirSync(join(FIXTURES, "api")), ...contractFiles, ...FIXTURE_ENDPOINTS.map((endpoint) => `${endpoint}.json`)]);

/** Recordings first, so the store the app's error strings name becomes `example-store`. */
const entries: { target: string; from: string }[] = [
	...readdirSync(source)
		.filter((file) => wanted.has(file))
		.sort()
		.map((file) => ({ target: join(FIXTURES, "api", file), from: join(source, file) })),
	...(values.endpoints ? [{ target: join(FIXTURES, "apiEndpoints.json"), from: values.endpoints }] : []),
	...contractFiles.sort().map((file) => ({ target: join(FIXTURES, "contract", file), from: join(FIXTURES, "contract", file) })),
	...readdirSync(FIXTURES)
		.filter((file) => /^apiEndpoints.*\.json$/.test(file) && !(values.endpoints && file === "apiEndpoints.json"))
		.sort()
		.map((file) => ({ target: join(FIXTURES, file), from: join(FIXTURES, file) }))
];
const terms = values.terms ? (readJson(values.terms) as Record<string, string>) : {};
/** The app's export also documents endpoints only PepReviewPro staff call. This repository is public, so they stay out. */
const withoutInternal = (json: unknown) =>
	Array.isArray(json) ? json.filter((endpoint: { audience?: string }) => endpoint.audience !== "internal") : json;
const anonymized = anonymizeFixtures(
	entries.map(({ target, from }) => (/^apiEndpoints.*\.json$/.test(basename(target)) ? withoutInternal(readJson(from)) : readJson(from))),
	{ terms }
);
const outputs = await Promise.all(
	entries.map(async ({ target }, index) => {
		const text = `${JSON.stringify(anonymized[index], null, "\t")}\n`;
		const { ignored } = await getFileInfo(target, { ignorePath: join(ROOT, ".prettierignore") });
		const formatted = ignored ? text : await format(text, { ...(await resolveConfig(target)), filepath: target });
		return { target, text: formatted };
	})
);
const findings = outputs.flatMap(({ target, text }) =>
	findRealData(text).map((finding) => `${relative(ROOT, target)}:${finding.line.toString()}  ${finding.rule}`)
);
if (findings.length > 0) {
	console.error(findings.join("\n"));
	console.error(
		"The anonymised fixtures still hold data that could be real, so nothing was written. Teach scripts/data/anonymizeFixtures.ts the field."
	);
	process.exit(1);
}

for (const { target, text } of outputs) {
	const before = existsSync(target) ? readFileSync(target, "utf8") : "";
	if (before !== text) {
		writeFileSync(target, text);
		console.log(`wrote ${relative(ROOT, target)}`);
	}
}
