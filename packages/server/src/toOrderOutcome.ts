import type { OrderResult } from "@pepreviewpro/core";
import type { OrderOutcome } from "./types";

export function toOrderOutcome(result: OrderResult): OrderOutcome {
	return {
		id: result.id,
		status: result.status,
		queued: result.queued,
		duplicates: result.duplicates,
		...(result.skipped_reason ? { skippedReason: result.skipped_reason } : {})
	};
}
