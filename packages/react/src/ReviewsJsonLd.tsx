import { productJsonLd, serializeJsonLd, type ProductJsonLdInput, type WidgetData } from "@pepreviewpro/core";

/** The product the markup describes. Its rating and reviews come from `data`. */
export type JsonLdProduct = Omit<ProductJsonLdInput, "reviews" | "aggregate" | "minRating">;

export interface ReviewsJsonLdProps {
	/** The same data the page's widget shows, since markup that disagrees with the visible rating risks a manual action. */
	data: WidgetData;
	product: JsonLdProduct;
}

/**
 * Prints schema.org Product markup with the store's AggregateRating and up to 10 Review nodes. Nothing for a
 * product with no reviews and no offers. Renders on the server.
 */
export function ReviewsJsonLd({ data, product }: ReviewsJsonLdProps) {
	const markup = productJsonLd({ ...product, reviews: data.reviews, aggregate: data.aggregate, minRating: data.settings?.min_rating_display });
	return markup ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(markup) }} /> : null;
}
