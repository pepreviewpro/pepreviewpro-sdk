import type { WidgetReview } from "@pepreviewpro/core";
import { formatReviewDate } from "./formatReviewDate";
import { Stars } from "./Stars";
import { VerifiedBadge } from "./VerifiedBadge";

export interface ReviewListProps {
	reviews: WidgetReview[];
	/** Default true. Pass the store's `settings.show_verified_badge` to follow its widget settings. */
	showVerified?: boolean | undefined;
	className?: string | undefined;
}

/**
 * Reviews as a plain list of articles: stars, title, body, author, date, and the verified mark. Unstyled, with a
 * `data-prp-*` attribute on each part. Renders on the server, so the reviews are in the page's HTML.
 */
export function ReviewList({ reviews, showVerified = true, className }: ReviewListProps) {
	return (
		<ul className={className} data-prp-reviews="">
			{reviews.map((review) => (
				<li key={review.id} data-prp-review="">
					<article>
						<Stars rating={review.rating} />
						{review.title ? <p data-prp-review-title="">{review.title}</p> : null}
						<p data-prp-review-body="">{review.body}</p>
						<p data-prp-review-meta="">
							<span data-prp-review-author="">{review.reviewer_name}</span> <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>
							{review.is_verified && showVerified ? (
								<>
									{" "}
									<VerifiedBadge />
								</>
							) : null}
						</p>
					</article>
				</li>
			))}
		</ul>
	);
}
