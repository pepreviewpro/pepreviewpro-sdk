import type { ReactNode } from "react";

export interface VerifiedBadgeProps {
	/** Defaults to "Verified purchase", the dashboard's words. */
	children?: ReactNode;
	className?: string | undefined;
}

/** Marks a review PepReviewPro matched to a real order. Unstyled, and renders on the server. */
export function VerifiedBadge({ children = "Verified purchase", className }: VerifiedBadgeProps) {
	return (
		<span className={className} data-prp-verified="">
			{children}
		</span>
	);
}
