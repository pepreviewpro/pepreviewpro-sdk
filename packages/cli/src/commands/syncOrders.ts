import type { Order } from "@pepreviewpro/server";
import { createSdk } from "../createSdk";
import type { Io } from "../io";
import { loadEnv } from "../loadEnv";
import { parseDuration } from "../parseDuration";
import { readOrdersFile } from "../readOrdersFile";
import { requireSetup } from "../requireSetup";

/** When the order last changed, by its latest date. Null when it has none. */
function lastChange(order: Order): number | null {
	const times = [order.completedAt, order.paidAt, order.createdAt]
		.filter((date) => date !== null && date !== undefined)
		.map((date) => new Date(date as Date | string).getTime())
		.filter((time) => !Number.isNaN(time));
	return times.length > 0 ? Math.max(...times) : null;
}

/**
 * The daily re-send: every order in the file or stdin that changed within `--since`, sent with email on. Orders
 * PepReviewPro already has come back unchanged; one it missed is created and queues its request late. Orders with
 * no date are left out, so a full export can never mail old buyers.
 */
export async function syncOrders(
	io: Io,
	file: string | undefined,
	flags: { store?: string | undefined; since?: string | undefined; csv?: boolean | undefined }
): Promise<number> {
	const env = await loadEnv(io);
	const { store, apiKey } = requireSetup(env, flags.store);
	const since = flags.since ?? "48h";
	const cutoff = io.now() - parseDuration(since);
	const orders = await readOrdersFile(file ?? "-", io, { csv: flags.csv });
	const undated = orders.filter((order) => lastChange(order) === null).length;
	const recent = orders.filter((order) => (lastChange(order) ?? -Infinity) >= cutoff);
	io.out(`Re-sending ${recent.length} orders from the last ${since} to ${store}.${undated > 0 ? ` ${undated} had no date and were left out.` : ""}`);
	if (recent.length === 0) {
		return 0;
	}

	const totals = await createSdk(io, env, store, apiKey).orders.import(recent, { sendEmail: true });
	io.out(
		`Done. ${totals.created} were missing and are now in, ${totals.updated} updated, ${totals.unchanged} unchanged, ${totals.queued} requests queued.`
	);
	return 0;
}
