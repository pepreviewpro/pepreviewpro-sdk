import type { ExternalId, WidgetData } from "@pepreviewpro/core";
import { ReviewsJsonLd as JsonLd, type JsonLdProduct } from "@pepreviewpro/react";
import type { GetReviewsOptions } from "./types";

export interface ReviewsJsonLdProps {
	product: JsonLdProduct & { productRef?: ExternalId | undefined };
	/** The store's slug. Defaults to `PEPREVIEWPRO_STORE`. */
	store?: string | undefined;
	/** The `getReviews` result the page's widget already shows. Fetched, from the same cache, when left out. */
	data?: WidgetData | undefined;
}

/** `<ReviewsJsonLd>` over one of the cached readers, so each entry point's version reads through its own cache. */
export function createReviewsJsonLd(read: (options: GetReviewsOptions) => Promise<WidgetData>) {
	return async function ReviewsJsonLd({ product: { productRef, ...product }, store, data }: ReviewsJsonLdProps) {
		return <JsonLd data={data ?? (await read({ store, productRef }))} product={product} />;
	};
}
