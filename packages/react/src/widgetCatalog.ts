/**
 * The dashboard's widget names by runtime `type`, copied from `WIDGET_CATALOG` in the app's
 * `lib/widgets/widgetCatalog.ts`. Each component is this name without spaces; `test/widgets.test.tsx` fails if one drifts.
 */
export const WIDGET_CATALOG = {
	"carousel": "Carousel",
	"grid": "Review Wall",
	"badge": "Trust Badge",
	"floating": "Floating Badge",
	"mini-stars": "Product Stars",
	"sidebar": "Sidebar Panel",
	"ticker": "Review Ticker",
	"trust-seal": "Trust Seal",
	"form": "Review Form"
} as const;

export type WidgetType = keyof typeof WIDGET_CATALOG;
