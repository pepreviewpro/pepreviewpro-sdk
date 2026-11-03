import { PepReviewProPartner, type DirectoryReviewsPage } from "@pepreviewpro/server";
import { unstable_cache } from "next/cache";
import { DIRECTORY_CACHE_TAG, DIRECTORY_REVALIDATE_SECONDS } from "./cacheTags";
import { directoryCacheKey } from "./directoryCacheKey";
import type { DirectoryReviewsQuery } from "./directoryTypes";

/**
 * Approved reviews across the directory, as `reviews.list` reads them, cached for five minutes with `unstable_cache` and tagged
 * `pepreviewpro:directory`. A read served from the cache never reaches the API, so the stores in it are not counted
 * as served: report `shown` events for what you show.
 */
export function getDirectoryReviews(query: DirectoryReviewsQuery = {}): Promise<DirectoryReviewsPage> {
	return unstable_cache(() => new PepReviewProPartner().reviews.list(query), ["pepreviewpro", "directory", "reviews", directoryCacheKey(query)], {
		tags: [DIRECTORY_CACHE_TAG],
		revalidate: DIRECTORY_REVALIDATE_SECONDS
	})();
}
