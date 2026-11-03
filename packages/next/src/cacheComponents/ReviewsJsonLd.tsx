import { createReviewsJsonLd } from "../createReviewsJsonLd";
import { getReviews } from "./getReviews";

/** `<ReviewsJsonLd>` reading through the `"use cache"` `getReviews`. */
export const ReviewsJsonLd = createReviewsJsonLd(getReviews);
