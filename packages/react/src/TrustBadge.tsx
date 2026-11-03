"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** The store's score and stars in a compact badge. */
export function TrustBadge(props: WidgetProps) {
	return <RuntimeWidget type="badge" {...props} />;
}
