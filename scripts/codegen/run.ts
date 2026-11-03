import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkApiTypes, type ExportedEndpoint } from "./checkApiTypes";

const TYPES_FILE = fileURLToPath(new URL("../../packages/core/src/types.ts", import.meta.url));

/** The export is the `apiEndpoints` array, bare or under an `apiEndpoints` or `endpoints` key. */
function readEndpoints(path: string): ExportedEndpoint[] {
	const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
	const list = Array.isArray(parsed)
		? parsed
		: ((parsed as Record<string, unknown>)["apiEndpoints"] ?? (parsed as Record<string, unknown>)["endpoints"]);
	if (!Array.isArray(list)) {
		throw new Error(`${path} is not an apiEndpoints export.`);
	}

	return list as ExportedEndpoint[];
}

const [path] = process.argv.slice(2);
if (!path) {
	console.error("Usage: pnpm codegen <apiEndpoints.json>");
	process.exit(2);
}

const { errors, warnings } = checkApiTypes(readEndpoints(path), TYPES_FILE);
for (const warning of warnings) {
	console.warn(`warn  ${warning}`);
}

for (const error of errors) {
	console.error(`fail  ${error}`);
}

console.log(errors.length === 0 ? "The SDK's types match the documented API." : `${errors.length} fields the SDK reads are not documented.`);
process.exitCode = errors.length === 0 ? 0 : 1;
