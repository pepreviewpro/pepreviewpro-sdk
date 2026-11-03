"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** Several reviews at once, for testimonial pages. */
export function ReviewWall(props: WidgetProps) {
	return <RuntimeWidget type="grid" {...props} />;
}
