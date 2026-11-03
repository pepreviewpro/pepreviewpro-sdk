"use client";
import type { SubmitReviewResponse } from "@pepreviewpro/core";
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useSubmitReview, type SubmitReviewOptions } from "./useSubmitReview";
import { validateReview, type ReviewDraft, type ReviewField } from "./validateReview";

export interface ReviewFormProps extends SubmitReviewOptions {
	/** A rating to preselect, like the one a review request email's star link carries. */
	rating?: number | undefined;
	className?: string | undefined;
	onSubmitted?: ((response: SubmitReviewResponse) => void) | undefined;
}

const RATINGS = [5, 4, 3, 2, 1] as const;
const MAX_BODY = 1000;

function FieldError({ id, children }: { id: string; children: ReactNode }) {
	return (
		<p id={id} role="alert" data-prp-field-error="">
			{children}
		</p>
	);
}

/**
 * The review form, unstyled: every part carries a `data-prp-*` attribute to style it by. Posts to `submit-review`
 * with the store's own product and order ids, which the WordPress form widget cannot send. The review waits until
 * its author confirms it by email.
 */
export function ReviewForm({ store, productRef, orderRef, rating, className, onSubmitted }: ReviewFormProps) {
	const id = useId();
	const { submit, status, error } = useSubmitReview({ store, productRef, orderRef });
	const [draft, setDraft] = useState<ReviewDraft>({
		rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : 0,
		body: "",
		reviewerName: "",
		reviewerEmail: ""
	});
	const [errors, setErrors] = useState<Partial<Record<ReviewField, string>>>({});
	const fields = useRef<Partial<Record<ReviewField, HTMLElement | null>>>({});
	const success = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (status === "success") {
			success.current?.focus();
		}
	}, [status]);
	const errorId = (field: ReviewField) => `${id}-${field}-error`;
	const describedBy = (field: ReviewField, extra?: string) => [errors[field] ? errorId(field) : null, extra].filter(Boolean).join(" ") || undefined;
	const set = (field: Exclude<ReviewField, "rating">) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
		setDraft((current) => ({ ...current, [field]: event.target.value }));
	const send = async () => {
		const found = validateReview(draft);
		setErrors(found);
		const first = Object.keys(found)[0] as ReviewField | undefined;
		if (first) {
			fields.current[first]?.focus();
			return;
		}

		try {
			const response = await submit(draft);
			onSubmitted?.(response);
		} catch {
			// The hook keeps the API's message in `error`, which the alert below shows.
		}
	};

	if (status === "success") {
		return (
			<div ref={success} tabIndex={-1} role="status" className={className} data-prp-review-form="" data-prp-state="success">
				<p data-prp-success-title="">Thank you</p>
				<p>Your review is in. Check your email to verify it.</p>
			</div>
		);
	}

	return (
		<form
			noValidate
			className={className}
			data-prp-review-form=""
			aria-label="Write a review"
			onSubmit={(event) => {
				event.preventDefault();
				void send();
			}}>
			<fieldset data-prp-rating="" aria-describedby={describedBy("rating")}>
				<legend>Your rating</legend>
				{RATINGS.map((value, index) => (
					<label key={value} data-prp-rating-option="" data-checked={draft.rating === value ? "" : undefined}>
						<input
							ref={
								index === 0
									? (node) => {
											fields.current.rating = node;
										}
									: undefined
							}
							type="radio"
							name={`${id}-rating`}
							value={value}
							checked={draft.rating === value}
							aria-invalid={errors.rating ? true : undefined}
							onChange={() => setDraft((current) => ({ ...current, rating: value }))}
						/>
						{value === 1 ? "1 star" : `${value} stars`}
					</label>
				))}
			</fieldset>
			{errors.rating ? <FieldError id={errorId("rating")}>{errors.rating}</FieldError> : null}
			<div data-prp-field="body">
				<label htmlFor={`${id}-body`}>Your review</label>
				<textarea
					ref={(node) => {
						fields.current.body = node;
					}}
					id={`${id}-body`}
					rows={4}
					maxLength={MAX_BODY}
					value={draft.body}
					onChange={set("body")}
					aria-invalid={errors.body ? true : undefined}
					aria-describedby={describedBy("body", `${id}-body-count`)}
				/>
				<p id={`${id}-body-count`} data-prp-count="">
					{draft.body.length}/{MAX_BODY}
				</p>
				{errors.body ? <FieldError id={errorId("body")}>{errors.body}</FieldError> : null}
			</div>
			<div data-prp-field="name">
				<label htmlFor={`${id}-name`}>Your name</label>
				<input
					ref={(node) => {
						fields.current.reviewerName = node;
					}}
					id={`${id}-name`}
					type="text"
					autoComplete="name"
					maxLength={100}
					value={draft.reviewerName}
					onChange={set("reviewerName")}
					aria-invalid={errors.reviewerName ? true : undefined}
					aria-describedby={describedBy("reviewerName")}
				/>
				{errors.reviewerName ? <FieldError id={errorId("reviewerName")}>{errors.reviewerName}</FieldError> : null}
			</div>
			<div data-prp-field="email">
				<label htmlFor={`${id}-email`}>Your email</label>
				<input
					ref={(node) => {
						fields.current.reviewerEmail = node;
					}}
					id={`${id}-email`}
					type="email"
					autoComplete="email"
					maxLength={255}
					value={draft.reviewerEmail}
					onChange={set("reviewerEmail")}
					aria-invalid={errors.reviewerEmail ? true : undefined}
					aria-describedby={describedBy("reviewerEmail")}
				/>
				{errors.reviewerEmail ? <FieldError id={errorId("reviewerEmail")}>{errors.reviewerEmail}</FieldError> : null}
			</div>
			{status === "error" && error ? (
				<div role="alert" data-prp-submit-error="">
					<p>{error}</p>
					<button type="button" onClick={() => void send()}>
						Retry
					</button>
				</div>
			) : null}
			<button type="submit" disabled={status === "submitting"} aria-busy={status === "submitting" ? true : undefined}>
				{status === "submitting" ? "Submitting" : "Submit review"}
			</button>
		</form>
	);
}
