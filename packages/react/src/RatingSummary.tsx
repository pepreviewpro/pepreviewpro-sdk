import { widgetRating, type WidgetAggregate } from "@pepreviewpro/core";
import { roundRating } from "./roundRating";
import { Stars } from "./Stars";

const COUNT = new Intl.NumberFormat("en-US");

/** "4.8 out of 5 from 812 reviews", with the stars beside it. The number the widgets headline. */
export function RatingSummary({ aggregate }: { aggregate: WidgetAggregate }) {
	const rating = roundRating(widgetRating(aggregate));
	return (
		<p data-prp-summary="">
			<span aria-hidden="true">
				<Stars rating={rating} />
			</span>{" "}
			{aggregate.total === 0
				? "No reviews yet"
				: `${rating.toFixed(1)} out of 5 from ${COUNT.format(aggregate.total)} ${aggregate.total === 1 ? "review" : "reviews"}`}
		</p>
	);
}
