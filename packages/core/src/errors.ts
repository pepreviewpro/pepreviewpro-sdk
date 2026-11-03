/**
 * The API's error messages, word for word from its endpoint reference. Branch on `code` from `API_ERROR_CODES`;
 * these are for tests and logs. The keyed endpoints send them as `error.message`, the public ones as `error` or
 * `message`. Messages that name a scope or a method are prefixes: `insufficientScope` ends in the scope.
 */
export const API_ERRORS = {
	missingKey: "Send an API key in the Authorization header.",
	invalidKey: "This API key is not valid.",
	keyRevoked: "This API key has been revoked.",
	keyExpired: "This API key has expired.",
	/** Followed by the scope and ` scope.`, like `This API key does not have the store:orders scope.` */
	insufficientScope: "This API key does not have the ",
	rateLimit: "This key sent too many requests in one second. Retry after the seconds in Retry-After.",
	monthlyQuota: "This account has used its monthly request quota. It resets on the first of the month, UTC.",
	/** Followed by the method and ` only.`, like `This endpoint takes GET only.` */
	methodNotAllowed: "This endpoint takes ",
	internal: "Something failed on our side. Retry with backoff, and quote the request id if it keeps failing.",
	invalidBody: "The request body is not valid JSON or does not match this endpoint.",
	invalidLimit: "limit must be a whole number from 1 to 100.",
	invalidCursor: "cursor is not one this endpoint sent. Start again without it.",
	invalidReviewSort: "sort must be newest, oldest, highest, or lowest.",
	invalidStoreSort: "sort must be best, reviews, rating, or name.",
	invalidProductSort: "sort must be best, price, or rating.",
	invalidShipsTo: "ships_to must be a two-letter country code, like GB.",
	invalidPayment: "payment must be one of: card, crypto, bankTransfer, zelle, cashApp, venmo, paypal, other.",
	invalidInStock: "in_stock must be true or false.",
	invalidMinRating: "min_rating must be a number from 0 to 5.",
	compoundRequired: "compound is required.",
	uuidNotAccepted: "store takes the store's slug, like example-store, not a UUID.",
	storeRequired: "store is required because this key reaches more than one store. /api/v1/my-stores lists them.",
	storeNotFoundForKey: "This key does not reach that store.",
	storeNotInDirectory: "No store in the partner directory has that slug.",
	invalidUpdatedSince: "updated_since must be an ISO 8601 time.",
	invalidIdempotencyKey: "Idempotency-Key must be 1 to 200 characters.",
	idempotencyKeyInProgress: "A request with this Idempotency-Key is still running. Retry in a moment.",
	idempotencyKeyReused: "This Idempotency-Key was sent with a different body. Use a new key for a new request.",
	nameRequired: "name is required.",
	eventsNotArray: "events must be an array.",
	tooManyEvents: "Send at most 50 events per call.",
	notPartnerKey: "This endpoint takes partner keys only. Ask us to link your key to your partner account.",
	storeNotFound: "Store not found",
	siteIdRequired: "site_id is required",
	profileNotPublic: "Store profile is not public",
	missingFields: "Missing required fields",
	ratingOutOfRange: "Rating must be between 1 and 5",
	failedToSaveReview: "Failed to save review",
	publicInternal: "Internal server error"
} as const;

/**
 * The API's machine-readable error codes, from its endpoint reference: every failure from an endpoint that takes a
 * key carries one as `error.code`. The public endpoints send none.
 */
export const API_ERROR_CODES = [
	"missing_api_key",
	"invalid_api_key",
	"revoked_api_key",
	"expired_api_key",
	"insufficient_scope",
	"not_partner_key",
	"rate_limited",
	"monthly_quota_exceeded",
	"method_not_allowed",
	"internal_error",
	"invalid_body",
	"invalid_limit",
	"invalid_cursor",
	"invalid_sort",
	"invalid_min_rating",
	"invalid_ships_to",
	"invalid_payment",
	"invalid_in_stock",
	"invalid_updated_since",
	"missing_compound",
	"missing_name",
	"invalid_events",
	"too_many_events",
	"uuid_not_accepted",
	"store_required",
	"store_not_found",
	"invalid_idempotency_key",
	"idempotency_key_in_progress",
	"idempotency_key_reused"
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Why a 429 came back: the per-second limit, which clears, or the monthly quota, which does not until next month. */
export type LimitReason = "rate_limit" | "monthly_quota";

export interface ApiErrorInit {
	status: number;
	message: string;
	code?: string | undefined;
	details?: unknown;
	requestId?: string | undefined;
	body?: unknown;
	method: string;
	path: string;
}

const LIMIT_REASONS: Partial<Record<string, LimitReason>> = { rate_limited: "rate_limit", monthly_quota_exceeded: "monthly_quota" };

/** The API answered with an error. `message` is the API's own, exactly as sent. */
export class PepReviewProApiError extends Error {
	override readonly name = "PepReviewProApiError";
	readonly status: number;
	/**
	 * The stable code, like `invalid_sort`: branch on this. One of `API_ERROR_CODES`, or a newer one the API added.
	 * Undefined from the public endpoints and from a proxy's own error page.
	 */
	readonly code: ApiErrorCode | (string & Record<never, never>) | undefined;
	/** On a 429: whether the per-second limit or the monthly quota refused it. */
	readonly reason: LimitReason | undefined;
	/** Per-field problems on an `invalid_body`, as `{ formErrors, fieldErrors }`. */
	readonly details: unknown;
	/** The request's id, from the body or the `X-Request-Id` header. Quote it to support. */
	readonly requestId: string | undefined;
	readonly body: unknown;
	readonly method: string;
	readonly path: string;

	constructor(init: ApiErrorInit) {
		super(init.message);
		this.status = init.status;
		this.code = init.code;
		this.reason = init.status === 429 && init.code ? LIMIT_REASONS[init.code] : undefined;
		this.details = init.details;
		this.requestId = init.requestId;
		this.body = init.body;
		this.method = init.method;
		this.path = init.path;
	}

	/** The key is missing, unknown, revoked, expired, or lacks the scope. Retrying will not help. */
	get isAuthError(): boolean {
		return this.status === 401 || this.code === "insufficient_scope";
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}
}

/** The request never got an answer: DNS, TLS, a reset connection, or the timeout. */
export class PepReviewProNetworkError extends Error {
	override readonly name = "PepReviewProNetworkError";
	readonly method: string;
	readonly path: string;

	constructor(method: string, path: string, cause: unknown) {
		super(`${method} ${path} failed before the API answered: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
		this.method = method;
		this.path = path;
	}
}
