import { roundRating } from "./roundRating";

export interface StarsProps {
	/** 0 to 5. */
	rating: number;
	/** Defaults to "Rated 4.8 out of 5". */
	label?: string | undefined;
	className?: string | undefined;
}

/**
 * Five stars as text, unstyled: `data-filled` marks the filled ones. Read as one image with the rating as its name,
 * so a screen reader hears the number instead of five symbols. Renders on the server.
 */
export function Stars({ rating, label, className }: StarsProps) {
	const value = roundRating(Math.min(5, Math.max(0, rating)));
	const filled = Math.round(value);
	return (
		<span role="img" aria-label={label ?? `Rated ${value.toFixed(1)} out of 5`} className={className} data-prp-stars="" data-rating={value}>
			{[1, 2, 3, 4, 5].map((star) => (
				<span key={star} aria-hidden="true" data-filled={star <= filled ? "" : undefined}>
					{star <= filled ? "★" : "☆"}
				</span>
			))}
		</span>
	);
}
