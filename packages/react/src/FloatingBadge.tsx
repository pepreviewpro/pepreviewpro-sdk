"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** Stays in a corner of every page and links to the store's reviews. */
export function FloatingBadge(props: WidgetProps) {
	return <RuntimeWidget type="floating" {...props} />;
}
