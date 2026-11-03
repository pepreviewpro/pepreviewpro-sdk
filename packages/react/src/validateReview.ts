export interface ReviewDraft {
	rating: number;
	body: string;
	reviewerName: string;
	reviewerEmail: string;
}

export type ReviewField = keyof ReviewDraft;

/**
 * Field errors in form order, so the first key is the field to focus. Empty when the draft can be sent. The same
 * rules and words as the app's own review form, so a review the widget would refuse is refused here too.
 */
export function validateReview(draft: ReviewDraft): Partial<Record<ReviewField, string>> {
	const errors: Partial<Record<ReviewField, string>> = {};
	const name = draft.reviewerName.trim();
	const email = draft.reviewerEmail.trim();
	const body = draft.body.trim();
	if (!draft.rating) {
		errors.rating = "Please select a star rating";
	}

	if (!body) {
		errors.body = "Review is required";
	} else if (body.length < 20) {
		errors.body = "Minimum 20 characters";
	} else if (body.length > 1000) {
		errors.body = "Maximum 1000 characters";
	}

	if (!name) {
		errors.reviewerName = "Name is required";
	} else if (name.length > 100) {
		errors.reviewerName = "Maximum 100 characters";
	}

	if (!email) {
		errors.reviewerEmail = "Email is required";
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		errors.reviewerEmail = "Invalid email address";
	} else if (email.length > 255) {
		errors.reviewerEmail = "Maximum 255 characters";
	}

	return errors;
}
