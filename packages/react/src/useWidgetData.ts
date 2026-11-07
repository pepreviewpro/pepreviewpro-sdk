"use client";
import type { WidgetData } from "@pepreviewpro/core";
import { useEffect, useState } from "react";
import { fetchWidgetData } from "./fetchWidgetData";
import type { ReviewsSource } from "./types";
import { usePepReviewPro } from "./usePepReviewPro";

export interface WidgetDataState {
	/** Null until it loads, and after an error. */
	data: WidgetData | null;
	loading: boolean;
	error: Error | null;
}

/**
 * Star-only and below-minimum reviews are dropped after the fetch, so a short `limit` could leave a widget with
 * fewer than it asked for. Every read takes the largest page instead, and `limit` only trims what each one shows.
 */
const PAGE_LIMIT = 50;

/** `data` when given; otherwise the store's public `widget-data`, fetched in the browser. */
export function useWidgetData({ data, store, productRef }: ReviewsSource = {}): WidgetDataState {
	const settings = usePepReviewPro();
	const slug = store ?? settings.store;
	const [state, setState] = useState<WidgetDataState>({ data: null, loading: !data && Boolean(slug), error: null });
	useEffect(() => {
		if (data) {
			return;
		}

		if (!slug) {
			setState({ data: null, loading: false, error: new Error("Pass store, or render inside <PepReviewProProvider store>.") });
			return;
		}

		let current = true;
		setState((previous) => ({ ...previous, loading: true, error: null }));
		fetchWidgetData({ baseUrl: settings.baseUrl, store: slug, productRef, limit: PAGE_LIMIT }).then(
			(loaded) => current && setState({ data: loaded, loading: false, error: null }),
			(error: unknown) => current && setState({ data: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
		);
		return () => {
			current = false;
		};
	}, [data, slug, productRef, settings.baseUrl]);
	return data ? { data, loading: false, error: null } : state;
}
