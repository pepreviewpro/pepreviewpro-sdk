"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** The rating and its breakdown, for under a product title. */
export function ProductStars(props: WidgetProps) {
	return <RuntimeWidget type="mini-stars" {...props} />;
}
