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

/** `data` when given; otherwise the store's public `widget-data`, fetched in the browser. */
export function useWidgetData({ data, store, productRef, limit }: ReviewsSource = {}): WidgetDataState {
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
		fetchWidgetData({ baseUrl: settings.baseUrl, store: slug, productRef, limit }).then(
			(loaded) => current && setState({ data: loaded, loading: false, error: null }),
			(error: unknown) => current && setState({ data: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
		);
		return () => {
			current = false;
		};
	}, [data, slug, productRef, limit, settings.baseUrl]);
	return data ? { data, loading: false, error: null } : state;
}
