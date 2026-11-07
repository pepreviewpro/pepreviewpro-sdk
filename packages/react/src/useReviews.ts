"use client";
import type { WidgetReview } from "@pepreviewpro/core";
import type { ReviewsSource } from "./types";
import { useWidgetData, type WidgetDataState } from "./useWidgetData";
import { visibleReviews } from "./visibleReviews";

export interface ReviewsState extends WidgetDataState {
	/** The reviews the widgets list: at or above the store's minimum rating, with written text, newest first. Empty while loading. */
	reviews: WidgetReview[];
}

/** A store's or one product's reviews, for stores that render their own design. */
export function useReviews(source: ReviewsSource = {}): ReviewsState {
	const state = useWidgetData(source);
	return { ...state, reviews: state.data ? visibleReviews(state.data, 1, source.limit) : [] };
}
