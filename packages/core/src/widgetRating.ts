import type { WidgetAggregate } from "./types";

/** The number the widgets headline: the PepReviewPro score, or the plain average when a payload has none. */
export function widgetRating(aggregate: Pick<WidgetAggregate, "average_rating"> & { score?: number | null }): number {
	return aggregate.score ?? aggregate.average_rating;
}
