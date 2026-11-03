import { assertId } from "./assertId";
import { backoffDelay } from "./backoffDelay";
import { buildQuery } from "./buildQuery";
import { createIdempotencyKey } from "./createIdempotencyKey";
import { PepReviewProApiError, PepReviewProNetworkError } from "./errors";
import { parseRetryAfter } from "./parseRetryAfter";
import type {
	CatalogRequest,
	CatalogResponse,
	DirectoryReviewsQuery,
	DirectoryReviewsResponse,
	HeartbeatRequest,
	HeartbeatResponse,
	MeResponse,
	MyReviewsQuery,
	MyReviewsResponse,
	MyStoresQuery,
	MyStoresResponse,
	OrdersRequest,
	OrdersResponse,
	PartnerEventsRequest,
	PartnerEventsResponse,
	ProductsQuery,
	ProductsResponse,
	StoreProfileResponse,
	StoresQuery,
	StoresResponse,
	SubmitReviewRequest,
	SubmitReviewResponse,
	VendorMissRequest,
	VendorMissResponse,
	WidgetDataQuery,
	WidgetDataResponse
} from "./types";

export const DEFAULT_BASE_URL = "https://pepreviewpro.com";

/** The most orders one `POST /api/v1/orders` call carries. */
export const MAX_ORDERS_PER_REQUEST = 200;

/** The longest `Idempotency-Key` the API takes. */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/** The most products one `PUT /api/v1/catalog` call carries. */
export const MAX_CATALOG_PRODUCTS = 5000;

/** The most events one `POST /api/v1/partner-events` call carries. */
export const MAX_PARTNER_EVENTS = 50;

/** The most of `name` and of `question` that `POST /api/v1/vendor-miss` keeps. */
export const MAX_VENDOR_MISS_NAME = 120;
export const MAX_VENDOR_MISS_QUESTION = 200;

/** The most items one page of a list holds. Every list defaults to 20. */
export const MAX_PAGE_LIMIT = 100;

export interface ClientOptions {
	/** Defaults to https://pepreviewpro.com. */
	baseUrl?: string;
	/** A store key (`sk_live_…`) or owner key. Only the server package passes one; public reads need none. */
	apiKey?: string | undefined;
	/** Defaults to the global `fetch`. */
	fetch?: typeof fetch;
	/** Retries after the first attempt. Default 3. */
	maxRetries?: number;
	/** Default 500. */
	baseDelayMs?: number;
	/** Default 20,000. */
	maxDelayMs?: number;
	/** A `Retry-After` longer than this is thrown instead of waited out. Default 60,000. */
	maxRetryAfterMs?: number;
	/** Per attempt. Default 30,000. */
	timeoutMs?: number;
	/** Sent as `User-Agent` on keyed requests only, so browser reads stay free of preflights. */
	userAgent?: string | undefined;
	/** Returns a number in [0, 1). For tests. */
	random?: () => number;
	/** For tests. */
	sleep?: (ms: number) => Promise<void>;
}

export interface CallOptions {
	signal?: AbortSignal | undefined;
}

/** For a write, which the API runs once per `Idempotency-Key`: `orders`, `catalog`, `heartbeat`, `vendorMiss`, and `partnerEvents`. */
export interface IdempotentCallOptions extends CallOptions {
	/**
	 * 1 to 200 characters, reused across this call's retries. Generated when left out. Reusing one with a different
	 * body throws `idempotency_key_reused`.
	 */
	idempotencyKey?: string | undefined;
}

/**
 * `always`: safe to repeat, so 429, 5xx, and network failures are retried. `rejected`: a POST that would act twice,
 * so only a 429, which the server refused before doing anything, is retried.
 */
type RetryPolicy = "always" | "rejected";

/** The header that makes a write safe to retry: one key per logical call, so every retry of it repeats the same key. */
function idempotencyHeader(key: string | undefined): Record<string, string> {
	if (key !== undefined && (key.length === 0 || key.length > MAX_IDEMPOTENCY_KEY_LENGTH)) {
		throw new RangeError(`An Idempotency-Key is 1 to ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`);
	}

	return { "idempotency-key": key ?? createIdempotencyKey() };
}

interface RequestSpec {
	method: "GET" | "POST" | "PUT";
	path: string;
	query?: object;
	body?: unknown;
	auth: boolean;
	retry: RetryPolicy;
	headers?: Record<string, string>;
	signal?: AbortSignal | undefined;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) {
		return null;
	}

	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * The keyed endpoints send `{ error: { code, message, request_id } }`. The public ones send a bare `error` or
 * `message` string, and a proxy may send plain text.
 */
function toApiError(response: Response, body: unknown, method: string, path: string): PepReviewProApiError {
	const record = asRecord(body);
	const envelope = asRecord(record["error"]);
	const message = asString(envelope["message"]) ?? asString(record["error"]) ?? asString(record["message"]);
	return new PepReviewProApiError({
		status: response.status,
		message: message ?? (typeof body === "string" && body ? body.slice(0, 200) : `HTTP ${response.status}`),
		code: asString(envelope["code"]),
		details: envelope["details"],
		requestId: asString(envelope["request_id"]) ?? response.headers.get("x-request-id") ?? undefined,
		body,
		method,
		path
	});
}

/** A 429 that clears, a write whose first try is still running, or a 5xx where the policy allows it. */
function isRetryable(error: PepReviewProApiError, retry: RetryPolicy): boolean {
	if (error.status === 429) {
		return error.reason !== "monthly_quota";
	}

	if (error.code === "idempotency_key_in_progress") {
		return true;
	}

	return error.status >= 500 && retry === "always";
}

/** The typed HTTP client for https://pepreviewpro.com/api/v1. Method names follow the endpoint paths. */
export class PepReviewProClient {
	readonly baseUrl: string;
	readonly #apiKey: string | undefined;
	readonly #fetch: typeof fetch;
	readonly #maxRetries: number;
	readonly #backoff: { baseDelayMs: number; maxDelayMs: number; random: () => number };
	readonly #maxRetryAfterMs: number;
	readonly #timeoutMs: number;
	readonly #userAgent: string | undefined;
	readonly #sleep: (ms: number) => Promise<void>;

	constructor(options: ClientOptions = {}) {
		this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
		this.#apiKey = options.apiKey?.trim() || undefined;
		this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
		this.#maxRetries = Math.max(0, options.maxRetries ?? 3);
		this.#backoff = { baseDelayMs: options.baseDelayMs ?? 500, maxDelayMs: options.maxDelayMs ?? 20_000, random: options.random ?? Math.random };
		this.#maxRetryAfterMs = options.maxRetryAfterMs ?? 60_000;
		this.#timeoutMs = options.timeoutMs ?? 30_000;
		this.#userAgent = options.userAgent;
		this.#sleep = options.sleep ?? defaultSleep;
	}

	get hasApiKey(): boolean {
		return this.#apiKey !== undefined;
	}

	/** Public. What the review widgets render for one store, or one product with `product_ref`. */
	widgetData(query: WidgetDataQuery, options: CallOptions = {}): Promise<WidgetDataResponse> {
		return this.#request({ method: "GET", path: "/api/v1/widget-data", query, auth: false, retry: "always", signal: options.signal });
	}

	/** Public. A store's branding and widget settings. Answers 403 while its public page is off. */
	storeProfile(query: { site_id: string }, options: CallOptions = {}): Promise<StoreProfileResponse> {
		return this.#request({ method: "GET", path: "/api/v1/store-profile", query, auth: false, retry: "always", signal: options.signal });
	}

	/** Public. Saves a review that waits until its author confirms it by email. Not retried after the server has it. */
	submitReview(body: SubmitReviewRequest, options: CallOptions = {}): Promise<SubmitReviewResponse> {
		return this.#request({ method: "POST", path: "/api/v1/submit-review", body, auth: false, retry: "rejected", signal: options.signal });
	}

	/** Scope `store:read`. The stores the key reaches, with their branding, widget settings, and totals. */
	myStores(query: MyStoresQuery = {}, options: CallOptions = {}): Promise<MyStoresResponse> {
		return this.#request({ method: "GET", path: "/api/v1/my-stores", query, auth: true, retry: "always", signal: options.signal });
	}

	/** Scope `store:reviews`. Approved reviews and the aggregate, paged by `cursor`. */
	myReviews(query: MyReviewsQuery, options: CallOptions = {}): Promise<MyReviewsResponse> {
		return this.#request({ method: "GET", path: "/api/v1/my-reviews", query, auth: true, retry: "always", signal: options.signal });
	}

	/** Scope `store:orders`. Upserts up to 200 orders by id. An `Idempotency-Key` makes the retries safe. */
	orders(body: OrdersRequest, options: IdempotentCallOptions = {}): Promise<OrdersResponse> {
		if (body.orders.length === 0 || body.orders.length > MAX_ORDERS_PER_REQUEST) {
			throw new RangeError(`Send 1 to ${MAX_ORDERS_PER_REQUEST} orders per call, got ${body.orders.length}.`);
		}

		const headers = idempotencyHeader(options.idempotencyKey);
		body.orders.forEach((order, index) => {
			assertId(order.id, `orders[${index}].id`);
			order.line_items?.forEach((item, itemIndex) => assertId(item.product_id, `orders[${index}].line_items[${itemIndex}].product_id`));
		});
		return this.#request({
			method: "POST",
			path: "/api/v1/orders",
			body,
			auth: true,
			retry: "always",
			headers,
			signal: options.signal
		});
	}

	/** Scope `store:catalog`. Replaces the store's catalog and, when sent, its shipping and payment methods. */
	catalog(body: CatalogRequest, options: IdempotentCallOptions = {}): Promise<CatalogResponse> {
		if (body.products.length > MAX_CATALOG_PRODUCTS) {
			throw new RangeError(`Send at most ${MAX_CATALOG_PRODUCTS} products, got ${body.products.length}.`);
		}

		const headers = idempotencyHeader(options.idempotencyKey);
		return this.#request({ method: "PUT", path: "/api/v1/catalog", body, auth: true, retry: "always", headers, signal: options.signal });
	}

	/** Scope `store:write`. Tells the dashboard's **Connection** card the SDK is running and what it does. */
	heartbeat(body: HeartbeatRequest, options: IdempotentCallOptions = {}): Promise<HeartbeatResponse> {
		const headers = idempotencyHeader(options.idempotencyKey);
		return this.#request({ method: "POST", path: "/api/v1/heartbeat", body, auth: true, retry: "always", headers, signal: options.signal });
	}

	/** Scope `stores:read`. The directory, ranked. With `compound`, each store carries `matched_products`. */
	stores(query: StoresQuery = {}, options: CallOptions = {}): Promise<StoresResponse> {
		return this.#request({ method: "GET", path: "/api/v1/stores", query, auth: true, retry: "always", signal: options.signal });
	}

	/** Scope `stores:read`. Products that map to one compound, each with its store's slug, name, and website. */
	products(query: ProductsQuery, options: CallOptions = {}): Promise<ProductsResponse> {
		return this.#request({ method: "GET", path: "/api/v1/products", query, auth: true, retry: "always", signal: options.signal });
	}

	/** Scope `reviews:read`. Approved reviews across the directory, or one store's, newest first. */
	reviews(query: DirectoryReviewsQuery = {}, options: CallOptions = {}): Promise<DirectoryReviewsResponse> {
		return this.#request({ method: "GET", path: "/api/v1/reviews", query, auth: true, retry: "always", signal: options.signal });
	}

	/**
	 * Scope `partner:write`. A store a user asked about that the partner could not show. Sent with an `Idempotency-Key`,
	 * so a retry after a 5xx or a dropped connection is never counted twice.
	 */
	vendorMiss(body: VendorMissRequest, options: IdempotentCallOptions = {}): Promise<VendorMissResponse> {
		const headers = idempotencyHeader(options.idempotencyKey);
		return this.#request({ method: "POST", path: "/api/v1/vendor-miss", body, auth: true, retry: "always", headers, signal: options.signal });
	}

	/**
	 * Scope `partner:write`, partner keys only. Up to 50 `shown` and `click` events. Each event without an `id` gets
	 * one, and the call an `Idempotency-Key`, both kept across retries, so a retry is never counted twice.
	 */
	partnerEvents(body: PartnerEventsRequest, options: IdempotentCallOptions = {}): Promise<PartnerEventsResponse> {
		if (body.events.length > MAX_PARTNER_EVENTS) {
			throw new RangeError(`Send at most ${MAX_PARTNER_EVENTS} events per call, got ${body.events.length}.`);
		}

		const headers = idempotencyHeader(options.idempotencyKey);
		const events = body.events.map((event) => (event.id ? event : { ...event, id: createIdempotencyKey() }));
		return this.#request({
			method: "POST",
			path: "/api/v1/partner-events",
			body: { ...body, events },
			auth: true,
			retry: "always",
			headers,
			signal: options.signal
		});
	}

	/** Scope `me:read`. The key's scopes and this month's usage. Never rate limited. */
	me(options: CallOptions = {}): Promise<MeResponse> {
		return this.#request({ method: "GET", path: "/api/v1/me", auth: true, retry: "always", signal: options.signal });
	}

	async #request<T>(spec: RequestSpec): Promise<T> {
		const url = `${this.baseUrl}${spec.path}${spec.query ? buildQuery(spec.query) : ""}`;
		const headers: Record<string, string> = { accept: "application/json", ...spec.headers };
		if (spec.body !== undefined) {
			headers["content-type"] = "application/json";
		}

		if (spec.auth) {
			if (!this.#apiKey) {
				throw new Error(`${spec.method} ${spec.path} needs an API key. Pass apiKey, or set PEPREVIEWPRO_API_KEY on the server.`);
			}

			headers["authorization"] = `Bearer ${this.#apiKey}`;
			if (this.#userAgent) {
				headers["user-agent"] = this.#userAgent;
			}
		}

		const body = spec.body === undefined ? undefined : JSON.stringify(spec.body);
		for (let attempt = 0; ; attempt++) {
			const canRetry = attempt < this.#maxRetries;
			let response: Response;
			try {
				response = await this.#attempt(url, { method: spec.method, headers, ...(body === undefined ? {} : { body }) }, spec.signal);
			} catch (error) {
				if (spec.signal?.aborted) {
					throw error;
				}

				if (canRetry && spec.retry === "always") {
					await this.#sleep(backoffDelay(attempt, null, this.#backoff));
					continue;
				}

				throw new PepReviewProNetworkError(spec.method, spec.path, error);
			}

			const parsed = await readBody(response);
			if (response.ok) {
				return parsed as T;
			}

			const apiError = toApiError(response, parsed, spec.method, spec.path);
			const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
			if (!isRetryable(apiError, spec.retry) || !canRetry || (retryAfterMs !== null && retryAfterMs > this.#maxRetryAfterMs)) {
				throw apiError;
			}

			await this.#sleep(backoffDelay(attempt, retryAfterMs, this.#backoff));
		}
	}

	async #attempt(url: string, init: RequestInit, signal: AbortSignal | undefined): Promise<Response> {
		const controller = new AbortController();
		const abort = () => controller.abort(signal?.reason);
		signal?.addEventListener("abort", abort, { once: true });
		const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${this.#timeoutMs} ms`)), this.#timeoutMs);
		try {
			if (signal?.aborted) {
				abort();
			}

			return await this.#fetch(url, { ...init, signal: controller.signal });
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
		}
	}
}
