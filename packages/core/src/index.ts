export { assertId } from "./assertId";
export { backoffDelay, type BackoffOptions } from "./backoffDelay";
export { buildQuery } from "./buildQuery";
export { createIdempotencyKey } from "./createIdempotencyKey";
export {
	API_ERRORS,
	API_ERROR_CODES,
	PepReviewProApiError,
	PepReviewProNetworkError,
	type ApiErrorCode,
	type ApiErrorInit,
	type LimitReason
} from "./errors";
export { isNumericId } from "./isNumericId";
export { parseRetryAfter } from "./parseRetryAfter";
export {
	DEFAULT_BASE_URL,
	MAX_CATALOG_PRODUCTS,
	MAX_IDEMPOTENCY_KEY_LENGTH,
	MAX_ORDERS_PER_REQUEST,
	MAX_PAGE_LIMIT,
	MAX_PARTNER_EVENTS,
	MAX_VENDOR_MISS_NAME,
	MAX_VENDOR_MISS_QUESTION,
	PepReviewProClient,
	type CallOptions,
	type ClientOptions,
	type IdempotentCallOptions
} from "./PepReviewProClient";
export { MAX_JSON_LD_REVIEWS, productJsonLd, type ProductJsonLd, type ProductJsonLdInput, type RatingNode, type ReviewNode } from "./productJsonLd";
export { refQuery } from "./refQuery";
export { serializeJsonLd } from "./serializeJsonLd";
export type * from "./types";
export { widgetRating } from "./widgetRating";

export const VERSION: string = __PACKAGE_VERSION__;
