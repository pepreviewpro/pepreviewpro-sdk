import { PepReviewProApiError } from "@pepreviewpro/server";
import { parseArgs } from "node:util";
import { doctor } from "./commands/doctor";
import { importOrdersCommand } from "./commands/importOrders";
import { init } from "./commands/init";
import { pushCatalog } from "./commands/pushCatalog";
import { syncOrders } from "./commands/syncOrders";
import { webhooksTest } from "./commands/webhooksTest";
import type { Io } from "./io";

export const VERSION: string = __PACKAGE_VERSION__;

const HELP = `pepreviewpro ${VERSION}

Usage: npx @pepreviewpro/cli <command> [options]
       pepreviewpro <command> [options], once @pepreviewpro/cli is installed

Commands:
  init                        Check your key, save it to .env.local, and point AI agents at the SDK's guides
  doctor [--dir <build>]      Check every part of the setup, and scan the build for keys
  import-orders <file>        Send past orders without email. CSV, JSON, or NDJSON. Resumable
  push-catalog <file.json>    Send your products, shipping, and payment methods
  sync-orders [<file>|-]      Re-send recent orders with email on. Reads stdin by default
  webhooks test <url>         Send a signed ping to your webhook route

Options:
  --store <slug>              The store's slug. Defaults to PEPREVIEWPRO_STORE
  --yes, -y                   init: answer yes to every question, for scripts and agents
  --no-agents                 init: leave AGENTS.md and CLAUDE.md alone
  --since <window>            sync-orders: how far back, like 48h or 7d. Default 48h
  --csv                       sync-orders: read stdin as CSV
  --restart                   import-orders: ignore a saved checkpoint
  --secret <whsec_...>        webhooks test: the endpoint's secret. Defaults to PEPREVIEWPRO_WEBHOOK_SECRET
  --help, --version

Your key is secret and server only. Bugs and security reports: support@pepreviewpro.com`;

/** Runs one command and returns its exit code. Failures print a message, never a stack, except unexpected ones. */
export async function main(argv: string[], io: Io): Promise<number> {
	let parsed;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				"store": { type: "string" },
				"dir": { type: "string" },
				"since": { type: "string" },
				"csv": { type: "boolean" },
				"restart": { type: "boolean" },
				"secret": { type: "string" },
				"yes": { type: "boolean", short: "y" },
				"no-agents": { type: "boolean" },
				"help": { type: "boolean", short: "h" },
				"version": { type: "boolean", short: "v" }
			}
		});
	} catch (error) {
		io.err(`${(error as Error).message}\n\n${HELP}`);
		return 1;
	}

	const { values, positionals } = parsed;
	const [command, file, target] = positionals;
	if (values.version) {
		io.out(VERSION);
		return 0;
	}

	if (values.help || !command) {
		io.out(HELP);
		return command || values.help ? 0 : 1;
	}

	try {
		switch (command) {
			case "init":
				return await init(io, { store: values.store, yes: values.yes, noAgents: values["no-agents"] });
			case "doctor":
				return await doctor(io, values);
			case "import-orders":
				return await importOrdersCommand(io, file, values);
			case "push-catalog":
				return await pushCatalog(io, file, values);
			case "sync-orders":
				return await syncOrders(io, file, values);
			case "webhooks":
				if (file !== "test") {
					io.err(`Unknown command "webhooks ${file ?? ""}". Did you mean \`webhooks test <url>\`?`);
					return 1;
				}

				return await webhooksTest(io, target, values);
			default:
				io.err(`Unknown command "${command}".\n\n${HELP}`);
				return 1;
		}
	} catch (error) {
		io.err(error instanceof PepReviewProApiError ? `PepReviewPro answered ${error.status}: ${error.message}` : (error as Error).message);
		return 1;
	}
}
