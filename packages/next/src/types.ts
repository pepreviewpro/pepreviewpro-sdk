import type { ExternalId } from "@pepreviewpro/core";

/** Plain values only, since the cached readers key their entries on them. */
export interface GetReviewsOptions {
	/** The store's slug. Defaults to `PEPREVIEWPRO_STORE`. */
	store?: string | undefined;
	/** The store's own product id. Leave out for the whole store. */
	productRef?: ExternalId | undefined;
	/** 1 to 50. Default 20. */
	limit?: number | undefined;
}
