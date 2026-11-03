"use client";
import type { WidgetAggregate } from "@pepreviewpro/core";
import type { ReviewsSource } from "./types";
import { useWidgetData, type WidgetDataState } from "./useWidgetData";

export interface AggregateState extends WidgetDataState {
	/** Null while loading. */
	aggregate: WidgetAggregate | null;
}

/** The rating the widgets headline, the review count, and the star distribution. */
export function useAggregate(source: ReviewsSource = {}): AggregateState {
	const state = useWidgetData(source);
	return { ...state, aggregate: state.data?.aggregate ?? null };
}
