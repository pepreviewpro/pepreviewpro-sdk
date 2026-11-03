import type { WidgetAggregate, WidgetReview } from "./types";
import { widgetRating } from "./widgetRating";

/** Google reads at most this many Review nodes from one Product, as the WordPress plugin emits. */
export const MAX_JSON_LD_REVIEWS = 10;

export interface ProductJsonLdInput {
	name: string;
	url: string;
	image?: string | string[] | undefined;
	description?: string | undefined;
	sku?: string | undefined;
	brand?: string | undefined;
	/** The store's own `Offer` or `AggregateOffer` nodes, so the page carries one Product instead of two. */
	offers?: Record<string, unknown> | Record<string, unknown>[] | undefined;
	reviews: Pick<WidgetReview, "reviewer_name" | "rating" | "title" | "body" | "created_at">[];
	aggregate: Pick<WidgetAggregate, "average_rating" | "total"> & { score?: number | null };
	/** The store's minimum rating to show, so the markup lists only reviews the widget shows. */
	minRating?: number | undefined;
	/** Up to 10. */
	maxReviews?: number | undefined;
}

export interface RatingNode {
	"@type": "Rating" | "AggregateRating";
	"ratingValue": number;
	"bestRating": 5;
	"worstRating": 1;
	"reviewCount"?: number;
}

export interface ReviewNode {
	"@type": "Review";
	"reviewRating": RatingNode;
	"author": { "@type": "Person"; "name": string };
	"reviewBody": string;
	"name"?: string;
	"datePublished"?: string;
}

export interface ProductJsonLd {
	"@context": "https://schema.org";
	"@type": "Product";
	"name": string;
	"url": string;
	"image"?: string | string[];
	"description"?: string;
	"sku"?: string;
	"brand"?: { "@type": "Brand"; "name": string };
	"offers"?: Record<string, unknown> | Record<string, unknown>[];
	"aggregateRating"?: RatingNode;
	"review"?: ReviewNode[];
}

function toReviewNode(review: ProductJsonLdInput["reviews"][number]): ReviewNode {
	const published = Date.parse(review.created_at);
	return {
		"@type": "Review",
		"reviewRating": { "@type": "Rating", "ratingValue": review.rating, "bestRating": 5, "worstRating": 1 },
		"author": { "@type": "Person", "name": review.reviewer_name.trim() || "Anonymous" },
		"reviewBody": review.body,
		...(review.title ? { name: review.title } : {}),
		...(Number.isNaN(published) ? {} : { datePublished: new Date(published).toISOString() })
	};
}

/**
 * schema.org Product markup with the store's AggregateRating and up to 10 Review nodes. The rating is the one the
 * widget shows, since markup that disagrees with the visible page risks a manual action. There is deliberately no
 * Organization variant: Google shows no stars for reviews a business hosts about itself. Null when there is nothing
 * to mark up: no reviews and no offers.
 */
export function productJsonLd(input: ProductJsonLdInput): ProductJsonLd | null {
	const hasRating = input.aggregate.total > 0;
	if (!hasRating && !input.offers) {
		return null;
	}

	const minRating = input.minRating ?? 1;
	const limit = Math.max(0, Math.min(MAX_JSON_LD_REVIEWS, input.maxReviews ?? MAX_JSON_LD_REVIEWS));
	const reviews = hasRating
		? input.reviews
				.filter((review) => review.rating >= minRating && review.body.trim() !== "")
				.slice(0, limit)
				.map(toReviewNode)
		: [];
	return {
		"@context": "https://schema.org",
		"@type": "Product",
		"name": input.name,
		"url": input.url,
		...(input.image ? { image: input.image } : {}),
		...(input.description ? { description: input.description } : {}),
		...(input.sku ? { sku: input.sku } : {}),
		...(input.brand ? { brand: { "@type": "Brand" as const, "name": input.brand } } : {}),
		...(input.offers ? { offers: input.offers } : {}),
		...(hasRating
			? {
					aggregateRating: {
						"@type": "AggregateRating" as const,
						"ratingValue": widgetRating(input.aggregate),
						"reviewCount": input.aggregate.total,
						"bestRating": 5 as const,
						"worstRating": 1 as const
					}
				}
			: {}),
		...(reviews.length > 0 ? { review: reviews } : {})
	};
}
