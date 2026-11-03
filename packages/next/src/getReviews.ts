import type { WidgetData } from "@pepreviewpro/core";
import { unstable_cache } from "next/cache";
import { cacheTags } from "./cacheTags";
import { DEFAULT_LIMIT, readReviews } from "./readReviews";
import { resolveStore } from "./resolveStore";
import type { GetReviewsOptions } from "./types";

/** The `hours` cache profile's revalidate time, so both readers refresh on the same clock. */
const HOUR_SECONDS = 3600;

/**
 * A store's reviews for server rendering, cached for an hour and tagged so the webhook route refreshes them the
 * moment a review changes. Uses `unstable_cache`, which works on Next.js 15 and on 16 without Cache Components.
 * With `cacheComponents: true`, import it from `@pepreviewpro/next/cache-components` instead.
 */
export function getReviews(options: GetReviewsOptions = {}): Promise<WidgetData> {
	const store = resolveStore(options.store);
	const limit = options.limit ?? DEFAULT_LIMIT;
	return unstable_cache(
		() => readReviews(store, { ...options, limit }),
		["pepreviewpro", "reviews", store, String(options.productRef ?? ""), String(limit)],
		{
			tags: cacheTags(store, options.productRef),
			revalidate: HOUR_SECONDS
		}
	)();
}
