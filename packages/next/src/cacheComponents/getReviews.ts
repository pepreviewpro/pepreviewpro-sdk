import type { WidgetData } from "@pepreviewpro/core";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "../cacheTags";
import { readReviews } from "../readReviews";
import { resolveStore } from "../resolveStore";
import type { GetReviewsOptions } from "../types";

/**
 * A store's reviews for server rendering, under `"use cache"` with the `hours` profile and tagged so the webhook
 * route refreshes them the moment a review changes. Needs `cacheComponents: true` on Next.js 16.
 */
export async function getReviews(options: GetReviewsOptions = {}): Promise<WidgetData> {
	"use cache";
	const store = resolveStore(options.store);
	cacheTag(...cacheTags(store, options.productRef));
	cacheLife("hours");
	return readReviews(store, options);
}
