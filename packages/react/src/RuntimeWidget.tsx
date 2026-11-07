"use client";
import { trackReviewsSeen } from "@pepreviewpro/browser";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loadRuntime } from "./loadRuntime";
import { RatingSummary } from "./RatingSummary";
import { ReviewList } from "./ReviewList";
import { runtimePayload, type RuntimeWidgetType } from "./runtimePayload";
import type { WidgetProps } from "./types";
import { usePepReviewPro } from "./usePepReviewPro";
import { useWidgetData } from "./useWidgetData";
import { visibleReviews } from "./visibleReviews";

/** Reviews each widget shows when the placement sets no limit, as the runtime and the plugin default them. */
const DEFAULT_LIMITS: Partial<Record<RuntimeWidgetType, number>> = { carousel: 10, grid: 6, sidebar: 4, ticker: 15 };

const VISUALLY_HIDDEN: CSSProperties = {
	position: "absolute",
	width: 1,
	height: 1,
	margin: -1,
	padding: 0,
	overflow: "hidden",
	clip: "rect(0 0 0 0)",
	whiteSpace: "nowrap",
	border: 0
};

/**
 * One widget, drawn by the WordPress runtime (`/embed/widgets.js`) inside a shadow root on this host, so it looks
 * exactly like the dashboard's.
 *
 * Known smell, kept only until `@pepreviewpro/widgets` lands (plan 26, step 5): the reviews are rendered twice. The
 * light-DOM copy below is for crawlers and no-JS readers; once the runtime attaches its shadow root, that copy is
 * unslotted, so it is neither drawn nor read. If the runtime fails to load, the copy is shown instead.
 */
export function RuntimeWidget({ type, className, data, store, productRef, limit, theme, ...options }: WidgetProps & { type: RuntimeWidgetType }) {
	const settings = usePepReviewPro();
	const { data: loaded } = useWidgetData({ data, store, productRef });
	const host = useRef<HTMLDivElement>(null);
	const [failed, setFailed] = useState(false);
	const payload = loaded ? runtimePayload(type, loaded, { ...options, limit, theme: theme ?? settings.theme }) : null;
	const showsReviews = Boolean(loaded && loaded.aggregate.total > 0);
	useEffect(() => {
		if (!payload) {
			return;
		}

		loadRuntime(`${settings.baseUrl}/embed/widgets.js`).then(
			() => setFailed(false),
			() => setFailed(true)
		);
	}, [payload, settings.baseUrl]);
	useEffect(() => {
		if (!payload || !showsReviews || !host.current) {
			return;
		}

		return trackReviewsSeen(host.current, settings.tracking);
	}, [payload, showsReviews, settings.tracking]);
	if (!loaded || !payload) {
		return null;
	}

	const listed = DEFAULT_LIMITS[type] === undefined ? [] : visibleReviews(loaded, options.minRating, limit ?? DEFAULT_LIMITS[type]);
	return (
		<div key={payload} ref={host} className={className ? `pepreviews-widget ${className}` : "pepreviews-widget"} data-pepreviews-widget={payload}>
			<div style={failed ? undefined : VISUALLY_HIDDEN} data-prp-fallback="">
				<p data-prp-store="">{loaded.store.name}</p>
				<RatingSummary aggregate={loaded.aggregate} />
				{listed.length > 0 ? <ReviewList reviews={listed} showVerified={loaded.settings?.show_verified_badge ?? true} /> : null}
			</div>
		</div>
	);
}
