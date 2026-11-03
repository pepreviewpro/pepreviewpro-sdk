"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** A column of recent reviews with the store's brand on top. */
export function SidebarPanel(props: WidgetProps) {
	return <RuntimeWidget type="sidebar" {...props} />;
}
