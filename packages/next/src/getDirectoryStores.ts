import { PepReviewProPartner, type DirectoryStoresPage } from "@pepreviewpro/server";
import { unstable_cache } from "next/cache";
import { DIRECTORY_CACHE_TAG, DIRECTORY_REVALIDATE_SECONDS } from "./cacheTags";
import { directoryCacheKey } from "./directoryCacheKey";
import type { DirectoryStoresQuery } from "./directoryTypes";

/**
 * The directory, ranked, as `stores.list` reads it, cached for five minutes with `unstable_cache` and tagged
 * `pepreviewpro:directory`. A read served from the cache never reaches the API, so the stores in it are not counted
 * as served: report `shown` events for what you show.
 */
export function getDirectoryStores(query: DirectoryStoresQuery = {}): Promise<DirectoryStoresPage> {
	return unstable_cache(() => new PepReviewProPartner().stores.list(query), ["pepreviewpro", "directory", "stores", directoryCacheKey(query)], {
		tags: [DIRECTORY_CACHE_TAG],
		revalidate: DIRECTORY_REVALIDATE_SECONDS
	})();
}
