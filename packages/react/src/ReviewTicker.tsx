"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** Reviews scrolling across the page. */
export function ReviewTicker(props: WidgetProps) {
	return <RuntimeWidget type="ticker" {...props} />;
}
