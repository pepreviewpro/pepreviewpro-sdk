"use client";
import { RuntimeWidget } from "./RuntimeWidget";
import type { WidgetProps } from "./types";

/** A verification seal with the rating, for footers and checkout. */
export function TrustSeal(props: WidgetProps) {
	return <RuntimeWidget type="trust-seal" {...props} />;
}
