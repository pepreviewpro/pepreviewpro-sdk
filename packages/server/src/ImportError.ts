import type { ImportCheckpoint } from "./types";

/** An import stopped partway. Pass `checkpoint` back to `orders.import` to carry on from the batch that failed. */
export class ImportError extends Error {
	override readonly name = "ImportError";
	readonly checkpoint: ImportCheckpoint;

	constructor(checkpoint: ImportCheckpoint, cause: unknown) {
		super(`Import stopped after ${checkpoint.processed} orders: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
		this.checkpoint = checkpoint;
	}
}
