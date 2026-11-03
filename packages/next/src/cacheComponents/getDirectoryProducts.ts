import { PepReviewProPartner, type DirectoryProductsPage } from "@pepreviewpro/server";
import { cacheLife, cacheTag } from "next/cache";
import { DIRECTORY_CACHE_TAG, DIRECTORY_REVALIDATE_SECONDS } from "../cacheTags";
import type { DirectoryProductsQuery } from "../directoryTypes";

/**
 * Products for one compound, each with its store, as `products.list` reads them, under `"use cache"` for five minutes and tagged
 * `pepreviewpro:directory`. Needs `cacheComponents: true`. A read served from the cache never reaches the API, so
 * the stores in it are not counted as served: report `shown` events for what you show.
 */
export async function getDirectoryProducts(query: DirectoryProductsQuery): Promise<DirectoryProductsPage> {
	"use cache";
	cacheTag(DIRECTORY_CACHE_TAG);
	cacheLife({ stale: DIRECTORY_REVALIDATE_SECONDS, revalidate: DIRECTORY_REVALIDATE_SECONDS, expire: DIRECTORY_REVALIDATE_SECONDS * 12 });
	return new PepReviewProPartner().products.list(query);
}
