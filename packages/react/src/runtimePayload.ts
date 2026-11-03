import type { WidgetData } from "@pepreviewpro/core";
import type { WidgetOptions } from "./types";
import type { WidgetType } from "./widgetCatalog";

/** The form is its own component; the runtime draws every other widget. */
export type RuntimeWidgetType = Exclude<WidgetType, "form">;

/**
 * The JSON the runtime reads from a host's `data-pepreviews-widget`, in the shape the WordPress plugin prints:
 * `{ type, options, data }`, with `app_url` beside the store rather than inside it.
 */
export function runtimePayload(type: RuntimeWidgetType, data: WidgetData, options: WidgetOptions): string {
	const { theme, limit, cols, minRating, link, align } = options;
	return JSON.stringify({
		type,
		options: { theme, limit, cols, minRating, link, align },
		data: { app_url: data.store.app_url, store: data.store, settings: data.settings, reviews: data.reviews, aggregate: data.aggregate }
	});
}
