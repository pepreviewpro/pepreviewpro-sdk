import type { WidgetAggregate } from "@pepreviewpro/core";
import type { GetReviewsOptions } from "../types";
import { getReviews } from "./getReviews";

/** The rating, count, and distribution from the same cached read as `getReviews`, so a page making both fetches once. */
export async function getAggregate(options: GetReviewsOptions = {}): Promise<WidgetAggregate> {
	return (await getReviews(options)).aggregate;
}
