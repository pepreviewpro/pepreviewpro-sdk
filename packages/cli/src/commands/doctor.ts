import { PepReviewProApiError } from "@pepreviewpro/server";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createSdk } from "../createSdk";
import type { Io } from "../io";
import { keyKind } from "../keyKind";
import { loadEnv } from "../loadEnv";
import { readPackageVersions } from "../readPackageVersions";
import { scanForKeys } from "../scanForKeys";
import { SDK_PACKAGES } from "../sdkPackages";

type Level = "ok" | "warn" | "fail";

/** What each command needs the key to have. */
const STORE_SCOPES = ["store:orders", "store:catalog", "store:reviews", "store:write"];

/** Client bundles by framework. Server output is left out: it never reaches a browser. */
const BUILD_DIRS = [".next/static", "dist/client", "build/client", "dist", "build", "out"];
const MIN_NODE = 20;

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function findBuildDir(cwd: string): Promise<string | null> {
	for (const dir of BUILD_DIRS) {
		if (await exists(join(cwd, dir))) {
			return join(cwd, dir);
		}
	}

	return null;
}

function describe(error: unknown): string {
	return error instanceof PepReviewProApiError ? error.message : (error as Error).message;
}

/**
 * Checks each part of the setup and prints what is missing: the key and store, that the API accepts both, which
 * capabilities the installed packages give, and that no key is built into the client bundle. Fails on a failed check.
 */
export async function doctor(io: Io, flags: { store?: string | undefined; dir?: string | undefined }): Promise<number> {
	let failed = false;
	const report = (level: Level, message: string) => {
		failed ||= level === "fail";
		(level === "fail" ? io.err : io.out)(`${level.padEnd(5)} ${message}`);
	};

	const major = Number(process.versions.node.split(".")[0]);
	report(major >= MIN_NODE ? "ok" : "fail", `Node ${process.versions.node}${major >= MIN_NODE ? "" : `: the SDK needs Node ${MIN_NODE} or later`}`);
	const env = await loadEnv(io);
	const store = flags.store ?? env.store;
	const kind = env.apiKey ? keyKind(env.apiKey) : null;
	if (!env.apiKey) {
		report("fail", "PEPREVIEWPRO_API_KEY is not set. Run `npx @pepreviewpro/cli init`.");
	} else if (!kind) {
		report("fail", "PEPREVIEWPRO_API_KEY is not a PepReviewPro key. A key is sk_live_ or pk_live_ and 40 letters and digits.");
	} else {
		report(
			kind === "store" ? "ok" : "warn",
			kind === "store" ? "Store key found." : "Owner key found. It counts toward 10,000 requests a month; a store key has no monthly cap."
		);
	}

	const exposed = Object.keys({ ...env.fileVars, ...io.env }).filter((name) => /^(NEXT_PUBLIC|VITE|PUBLIC|REACT_APP)_.*PEPREVIEWPRO.*KEY/.test(name));
	for (const name of exposed) {
		report("fail", `${name} would ship the key to the browser. Rename it to PEPREVIEWPRO_API_KEY.`);
	}

	if (!store) {
		report("fail", "PEPREVIEWPRO_STORE is not set. Run `npx @pepreviewpro/cli init`.");
	} else {
		const sdk = createSdk(io, env, store, kind ? env.apiKey : undefined);
		try {
			const { store: found, aggregate } = await sdk.reviews.list({ limit: 1 });
			report("ok", `Store ${store} is ${found.name}, with ${aggregate.total} reviews.`);
		} catch (error) {
			report("fail", `Store ${store} was not found: ${describe(error)}`);
		}

		if (kind) {
			try {
				const { key } = await sdk.me();
				const missing = STORE_SCOPES.filter((scope) => !key.scopes.includes(scope));
				report("ok", "The API accepts the key.");
				if (missing.length > 0) {
					report("warn", `The key does not have ${missing.join(", ")}. Create a store key on the Integrations page for every scope.`);
				}
			} catch (error) {
				report("fail", `The API refused the key: ${describe(error)}`);
			}
		}
	}

	const installed = await readPackageVersions(io.cwd, SDK_PACKAGES);
	const server = installed["@pepreviewpro/server"];
	const browser = installed["@pepreviewpro/browser"] ?? installed["@pepreviewpro/react"] ?? installed["@pepreviewpro/next"];
	report(
		server ? "ok" : "warn",
		server ? `Orders, catalog, and JSON-LD: @pepreviewpro/server ${server}.` : "Orders, catalog, and JSON-LD need @pepreviewpro/server."
	);
	report(
		browser ? "ok" : "warn",
		browser ? "Attribution and reviews seen: a browser package is installed." : "Attribution and reviews seen need @pepreviewpro/browser on your pages."
	);
	report(
		env.webhookSecret ? "ok" : "warn",
		env.webhookSecret ? "Webhooks: PEPREVIEWPRO_WEBHOOK_SECRET is set." : "Webhooks are off. Pages refresh on their cache time instead."
	);
	const dir = flags.dir ? resolve(io.cwd, flags.dir) : await findBuildDir(io.cwd);
	if (!dir || !(await exists(dir))) {
		report("warn", `No build output to scan${flags.dir ? ` at ${flags.dir}` : ""}. Build first, or pass --dir.`);
	} else {
		const findings = await scanForKeys(dir);
		const keys = findings.filter((finding) => finding.kind === "key");
		for (const finding of keys) {
			report("fail", `A key (${finding.keyPrefix}…) is in the client bundle at ${finding.file}:${finding.line}. Revoke it and move it to the server.`);
		}

		for (const finding of findings.filter((item) => item.kind === "prefix")) {
			report("warn", `"${finding.keyPrefix}" appears at ${finding.file}:${finding.line}. Check it is not part of a key.`);
		}

		if (keys.length === 0) {
			report("ok", `No key in the client bundle at ${dir}.`);
		}
	}

	return failed ? 1 : 0;
}
