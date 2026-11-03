import type { ExternalId } from "@pepreviewpro/core";

/**
 * The cache tags for a store's reviews, and for one product's when given: `pepreviewpro:<store>` and
 * `pepreviewpro:<store>:product:<product_ref>`. The webhook route revalidates the same ones.
 */
export function cacheTags(store: string, productRef?: ExternalId | null): string[] {
	const tags = [`pepreviewpro:${store}`];
	if (productRef !== undefined && productRef !== null && productRef !== "") {
		tags.push(`pepreviewpro:${store}:product:${productRef}`);
	}

	return tags;
}

/** The tag on every cached directory read. `revalidateTag` it to refetch the directory everywhere at once. */
export const DIRECTORY_CACHE_TAG = "pepreviewpro:directory";

/** How long a cached directory read is kept before it is read again, in seconds. */
export const DIRECTORY_REVALIDATE_SECONDS = 300;
