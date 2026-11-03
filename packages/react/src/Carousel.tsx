"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** Rotates through reviews under the store's overall rating. */
export function Carousel(props: WidgetProps) {
	return <RuntimeWidget type="carousel" {...props} />;
}
