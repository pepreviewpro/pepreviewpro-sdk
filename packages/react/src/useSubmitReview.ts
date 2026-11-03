"use client";
import { PepReviewProApiError, PepReviewProClient, refQuery, type ExternalId, type SubmitReviewResponse } from "@pepreviewpro/core";
import { useCallback, useState } from "react";
import { usePepReviewPro } from "./usePepReviewPro";

export interface SubmitReviewOptions {
	/** The store's slug. Defaults to the provider's. */
	store?: string | undefined;
	/** The store's own product id the review is for. */
	productRef?: ExternalId | undefined;
	/** The store's own order id, from the review request email's link. */
	orderRef?: ExternalId | undefined;
}

export interface ReviewInput {
	rating: number;
	body: string;
	reviewerName: string;
	reviewerEmail: string;
	title?: string | undefined;
}

export type SubmitStatus = "idle" | "submitting" | "success" | "error";

export interface SubmitReviewState {
	/** Resolves with the API's answer. Rejects with the API's own message on a refusal. */
	submit: (review: ReviewInput) => Promise<SubmitReviewResponse>;
	status: SubmitStatus;
	/** The API's message on a refusal, or a network failure's. */
	error: string | null;
	reset: () => void;
}

const FALLBACK_ERROR = "We couldn't submit your review. Please try again.";

/**
 * Posts a review to the public `submit-review` endpoint. It waits until its author confirms it by email, and is
 * matched to the order by `orderRef` when given. Takes no key.
 */
export function useSubmitReview({ store, productRef, orderRef }: SubmitReviewOptions = {}): SubmitReviewState {
	const settings = usePepReviewPro();
	const slug = store ?? settings.store;
	const [status, setStatus] = useState<SubmitStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const submit = useCallback(
		async (review: ReviewInput) => {
			if (!slug) {
				throw new Error("Pass store, or render inside <PepReviewProProvider store>.");
			}

			setStatus("submitting");
			setError(null);
			try {
				const response = await new PepReviewProClient({ baseUrl: settings.baseUrl }).submitReview({
					site_id: slug,
					rating: review.rating,
					body: review.body.trim(),
					reviewer_name: review.reviewerName.trim(),
					reviewer_email: review.reviewerEmail.trim(),
					...(review.title?.trim() ? { title: review.title.trim() } : {}),
					...refQuery("product", productRef),
					...refQuery("order", orderRef)
				});
				setStatus("success");
				return response;
			} catch (caught) {
				setStatus("error");
				setError(caught instanceof PepReviewProApiError ? caught.message : FALLBACK_ERROR);
				throw caught;
			}
		},
		[slug, productRef, orderRef, settings.baseUrl]
	);
	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
	}, []);
	return { submit, status, error, reset };
}
