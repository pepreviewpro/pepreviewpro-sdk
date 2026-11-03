/** First-party cookie holding the first touch, as JSON. The server package reads it at checkout. */
export const ATTRIBUTION_COOKIE = "prp_attribution";

/** The same window the app keeps a visitor's first touch for. */
export const ATTRIBUTION_DAYS = 30;

/** First-party cookie holding the unix seconds the reviews were last on screen. The widgets runtime writes the same one. */
export const REVIEWS_SEEN_COOKIE = "prp_reviews_seen";

/** How long before an order a look at the reviews still counts. */
export const REVIEWS_SEEN_DAYS = 7;
