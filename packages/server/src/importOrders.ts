import { MAX_ORDERS_PER_REQUEST } from "@pepreviewpro/core";
import { ImportError } from "./ImportError";
import type { ImportCheckpoint, ImportOptions, ImportTotals, Order, OrderOutcome } from "./types";

export type SendBatch = (orders: Order[]) => Promise<OrderOutcome[]>;

/**
 * Sends `source` in batches, skipping the orders a checkpoint says were already sent. `processed` counts from the
 * start of the source, skipped orders included, so it doubles as the next checkpoint; the other totals count this
 * run. A failed batch throws `ImportError` with the checkpoint before it. Re-sending is harmless, since orders upsert.
 */
export async function importOrders(
	source: AsyncIterable<Order> | Iterable<Order>,
	options: ImportOptions,
	sendBatch: SendBatch
): Promise<ImportTotals & { checkpoint: ImportCheckpoint }> {
	const size = Math.min(MAX_ORDERS_PER_REQUEST, Math.max(1, Math.floor(options.batchSize ?? MAX_ORDERS_PER_REQUEST)));
	const skip = Math.max(0, options.checkpoint?.processed ?? 0);
	const totals: ImportTotals = { processed: skip, created: 0, updated: 0, unchanged: 0, queued: 0 };
	let seen = 0;
	let batch: Order[] = [];
	const flush = async () => {
		let outcomes: OrderOutcome[];
		try {
			options.signal?.throwIfAborted();
			outcomes = await sendBatch(batch);
		} catch (error) {
			throw new ImportError({ processed: totals.processed }, error);
		}

		for (const outcome of outcomes) {
			totals[outcome.status] += 1;
			totals.queued += outcome.queued;
		}

		totals.processed += batch.length;
		batch = [];
		await options.onProgress?.({ ...totals, batch: outcomes, checkpoint: { processed: totals.processed } });
	};

	for await (const order of source) {
		seen += 1;
		if (seen <= skip) {
			continue;
		}

		batch.push(order);
		if (batch.length === size) {
			await flush();
		}
	}

	if (batch.length > 0) {
		await flush();
	}

	return { ...totals, checkpoint: { processed: totals.processed } };
}
