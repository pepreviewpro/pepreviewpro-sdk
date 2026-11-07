import type { WidgetData, WidgetReview } from "@pepreviewpro/core";

/**
 * The reviews a widget shows: at or above the store's minimum and the placement's, with written text, up to the
 * limit. Star-only reviews leave an empty card, so they count toward the rating but are not listed.
 */
export function visibleReviews(data: Pick<WidgetData, "reviews" | "settings">, minRating = 1, limit?: number): WidgetReview[] {
	const floor = Math.max(data.settings?.min_rating_display ?? 1, minRating);
	return data.reviews.filter((review) => review.rating >= floor && review.body.trim() !== "").slice(0, limit);
}
