import { ImportError } from "@pepreviewpro/server";
import { resolve } from "node:path";
import { readCheckpoint, removeCheckpoint, writeCheckpoint } from "../checkpointFile";
import { createSdk } from "../createSdk";
import type { Io } from "../io";
import { loadEnv } from "../loadEnv";
import { readOrdersFile } from "../readOrdersFile";
import { requireSetup } from "../requireSetup";

/**
 * Backfills past orders from a file without sending email. Saves its place beside the file after every batch, so
 * running the same command again after a failure carries on where it stopped. `--restart` starts from the top.
 */
export async function importOrdersCommand(
	io: Io,
	file: string | undefined,
	flags: { store?: string | undefined; restart?: boolean | undefined }
): Promise<number> {
	if (!file || file === "-") {
		io.err("Pass the file to import: `pepreviewpro import-orders orders.csv`. It needs a file to resume from.");
		return 1;
	}

	const env = await loadEnv(io);
	const { store, apiKey } = requireSetup(env, flags.store);
	const path = resolve(io.cwd, file);
	const orders = await readOrdersFile(path, io);
	const checkpoint = flags.restart ? null : await readCheckpoint(path, store);
	if (checkpoint) {
		io.out(`Resuming after ${checkpoint.processed} of ${orders.length} orders. Pass --restart to start over.`);
	}

	io.out(`Importing ${orders.length} orders to ${store}. No email is sent.`);
	try {
		const totals = await createSdk(io, env, store, apiKey).orders.import(orders, {
			checkpoint,
			onProgress: async (progress) => {
				await writeCheckpoint(path, store, progress.checkpoint);
				io.out(`${progress.processed} of ${orders.length} sent`);
			}
		});
		await removeCheckpoint(path);
		io.out(`Done. ${totals.created} new, ${totals.updated} updated, ${totals.unchanged} unchanged.`);
		return 0;
	} catch (error) {
		if (error instanceof ImportError) {
			await writeCheckpoint(path, store, error.checkpoint);
			io.err(`${error.message}\nRun the same command again to resume.`);
			return 1;
		}

		throw error;
	}
}
