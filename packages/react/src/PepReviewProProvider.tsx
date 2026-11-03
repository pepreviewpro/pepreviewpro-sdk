"use client";
import { captureAttribution, type TrackingOptions } from "@pepreviewpro/browser";
import { DEFAULT_BASE_URL } from "@pepreviewpro/core";
import { useEffect, useMemo, type ReactNode } from "react";
import { PepReviewProContext } from "./PepReviewProContext";
import type { Theme } from "./types";

export interface PepReviewProProviderProps extends TrackingOptions {
	/** The store's slug, like `example-store`. */
	store?: string | undefined;
	/** Every widget's theme unless it sets its own. Leave out for the store's widget settings. */
	theme?: Theme | undefined;
	/** Defaults to https://pepreviewpro.com. The widget runtime loads from `<baseUrl>/embed/widgets.js`. */
	baseUrl?: string | undefined;
	children?: ReactNode;
}

/**
 * Sets the store and theme for every widget and hook inside it, and records the shopper's first touch. The first
 * touch never changes once written, and a `consent` that turns true later records it then. `consent` and
 * `cookieDomain` apply to the widgets' reviews-seen mark too.
 */
export function PepReviewProProvider({ store, theme, baseUrl = DEFAULT_BASE_URL, consent, cookieDomain, children }: PepReviewProProviderProps) {
	const value = useMemo(
		() => ({
			store,
			theme,
			baseUrl: baseUrl.replace(/\/+$/, ""),
			tracking: { ...(consent === undefined ? {} : { consent }), ...(cookieDomain ? { cookieDomain } : {}) }
		}),
		[store, theme, baseUrl, consent, cookieDomain]
	);
	useEffect(() => {
		captureAttribution(value.tracking);
	}, [value.tracking]);
	return <PepReviewProContext.Provider value={value}>{children}</PepReviewProContext.Provider>;
}
