"use client";
import type { WidgetReview } from "@pepreviewpro/core";
import type { ReviewsSource } from "./types";
import { useWidgetData, type WidgetDataState } from "./useWidgetData";

export interface ReviewsState extends WidgetDataState {
	/** Approved reviews at or above the store's minimum rating, newest first. Empty while loading. */
	reviews: WidgetReview[];
}

/** A store's or one product's reviews, for stores that render their own design. */
export function useReviews(source: ReviewsSource = {}): ReviewsState {
	const state = useWidgetData(source);
	const minRating = state.data?.settings?.min_rating_display ?? 1;
	return { ...state, reviews: state.data?.reviews.filter((review) => review.rating >= minRating) ?? [] };
}
