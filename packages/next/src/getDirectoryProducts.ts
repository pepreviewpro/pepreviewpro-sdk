import { PepReviewProPartner, type DirectoryProductsPage } from "@pepreviewpro/server";
import { unstable_cache } from "next/cache";
import { DIRECTORY_CACHE_TAG, DIRECTORY_REVALIDATE_SECONDS } from "./cacheTags";
import { directoryCacheKey } from "./directoryCacheKey";
import type { DirectoryProductsQuery } from "./directoryTypes";

/**
 * Products for one compound, each with its store, as `products.list` reads them, cached for five minutes with `unstable_cache` and tagged
 * `pepreviewpro:directory`. A read served from the cache never reaches the API, so the stores in it are not counted
 * as served: report `shown` events for what you show.
 */
export function getDirectoryProducts(query: DirectoryProductsQuery): Promise<DirectoryProductsPage> {
	return unstable_cache(() => new PepReviewProPartner().products.list(query), ["pepreviewpro", "directory", "products", directoryCacheKey(query)], {
		tags: [DIRECTORY_CACHE_TAG],
		revalidate: DIRECTORY_REVALIDATE_SECONDS
	})();
}
