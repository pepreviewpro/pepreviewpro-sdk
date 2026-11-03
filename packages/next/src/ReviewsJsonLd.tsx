import { createReviewsJsonLd } from "./createReviewsJsonLd";
import { getReviews } from "./getReviews";

/**
 * A Server Component that prints the product's schema.org Product markup, with the rating and reviews the widget
 * shows. Nothing for a product with no reviews and no offers.
 */
export const ReviewsJsonLd = createReviewsJsonLd(getReviews);
