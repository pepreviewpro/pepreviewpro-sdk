import type { ExternalId, WidgetData } from "@pepreviewpro/core";

export type Theme = "light" | "dark" | "auto";

/** Where a widget's reviews come from: `data` already fetched on the server, or a store to fetch them for. */
export interface ReviewsSource {
	/** From `prp.reviews.list()` or `getReviews()` on the server, so the reviews are in the HTML. Skips the fetch. */
	data?: WidgetData | undefined;
	/** The store's slug. Defaults to the provider's. */
	store?: string | undefined;
	/** The store's own product id, for one product's reviews. Leave out for the whole store. */
	productRef?: ExternalId | undefined;
	/** Reviews to show, 1 to 50. */
	limit?: number | undefined;
}

/** The placement options the dashboard's widgets take, as the WordPress shortcodes write them. */
export interface WidgetOptions {
	/** Defaults to the provider's, then to the store's widget settings. */
	theme?: Theme | undefined;
	limit?: number | undefined;
	/** Review Wall only. */
	cols?: number | undefined;
	/** Hides reviews under this rating, on top of the store's own minimum. */
	minRating?: number | undefined;
	/** `false` drops the link to the store's PepReviewPro page. */
	link?: boolean | undefined;
	align?: "start" | "center" | undefined;
}

export interface WidgetProps extends ReviewsSource, WidgetOptions {
	className?: string | undefined;
}
