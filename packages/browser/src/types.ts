/**
 * The same shape as `Attribution` in `@pepreviewpro/core`, repeated so this package has no dependencies. A type
 * test in `test/types.test.ts` fails if the two drift.
 */
export interface Attribution {
	landing_url: string | null;
	referrer: string | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	utm_content: string | null;
	utm_term: string | null;
	/** ISO 8601. */
	first_seen_at: string | null;
}

export interface CheckoutContext {
	attribution: Attribution | null;
	/** Unix seconds the store's reviews were last on screen. */
	reviews_seen_at: number | null;
}

export interface TrackingOptions {
	/**
	 * Whether the shopper agreed to tracking cookies. A function is read each time a cookie would be written, so a
	 * consent banner can change its answer. Global Privacy Control turns tracking off whatever this says.
	 */
	consent?: boolean | (() => boolean);
	/** Set it, like `.example.com`, when checkout runs on another subdomain than the landing pages. */
	cookieDomain?: string;
}
