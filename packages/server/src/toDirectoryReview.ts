import type { ApiReview } from "@pepreviewpro/core";
import type { DirectoryReview } from "./directoryTypes";

/** A directory review in the SDK's names. */
export function toDirectoryReview(review: ApiReview): DirectoryReview {
	return {
		id: review.id,
		store: review.store,
		productRef: review.product_ref,
		rating: review.rating,
		title: review.title,
		body: review.body,
		author: review.author,
		verified: review.verified,
		createdAt: review.created_at,
		updatedAt: review.updated_at
	};
}
