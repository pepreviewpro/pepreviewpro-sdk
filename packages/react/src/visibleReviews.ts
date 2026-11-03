import type { WidgetData, WidgetReview } from "@pepreviewpro/core";

/** The reviews a widget shows: at or above the store's minimum and the placement's, up to the limit. */
export function visibleReviews(data: Pick<WidgetData, "reviews" | "settings">, minRating = 1, limit?: number): WidgetReview[] {
	const floor = Math.max(data.settings?.min_rating_display ?? 1, minRating);
	return data.reviews.filter((review) => review.rating >= floor).slice(0, limit);
}
