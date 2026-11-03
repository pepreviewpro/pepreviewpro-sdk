import type { WidgetData } from "@pepreviewpro/core";
import { PepReviewPro } from "@pepreviewpro/server";
import type { GetReviewsOptions } from "./types";

export const DEFAULT_LIMIT = 20;

/**
 * One store's reviews from public `widget-data`, uncached. The heartbeat stays off: a cached read must not start
 * background work that outlives it, and the order path sends the heartbeat anyway.
 */
export function readReviews(store: string, { productRef, limit = DEFAULT_LIMIT }: GetReviewsOptions): Promise<WidgetData> {
	return new PepReviewPro({ store, heartbeat: false }).reviews.list({ productRef, limit });
}
