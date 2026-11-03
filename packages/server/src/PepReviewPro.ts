import {
	VERSION as CORE_VERSION,
	MAX_ORDERS_PER_REQUEST,
	PepReviewProClient,
	productJsonLd,
	refQuery,
	type Capability,
	type ExternalId,
	type MyReview,
	type MyReviewsAggregate,
	type MyReviewsQuery,
	type ProductJsonLd,
	type ProductJsonLdInput,
	type WebhookEvent,
	type WidgetData
} from "@pepreviewpro/core";
import { chunk } from "./chunk";
import { detectRuntime } from "./detectRuntime";
import type { ApiKeyInfo } from "./directoryTypes";
import { importOrders } from "./importOrders";
import { paginate } from "./paginate";
import { readEnv } from "./readEnv";
import { readRequestContext, type RequestContext } from "./readRequestContext";
import { toApiKeyInfo } from "./toApiKeyInfo";
import { toIsoString } from "./toIsoString";
import { toOrderInput } from "./toOrderInput";
import { toOrderOutcome } from "./toOrderOutcome";
import type {
	CatalogInput,
	CatalogOutcome,
	DateInput,
	HeartbeatOptions,
	ImportCheckpoint,
	ImportOptions,
	ImportTotals,
	Order,
	OrderOutcome,
	UpsertOptions
} from "./types";
import { verifyWebhook } from "./verifyWebhook";

export const VERSION: string = __PACKAGE_VERSION__;

const DAY_MS = 86_400_000;
/** After a failed heartbeat, try again in an hour rather than on every call. */
const RETRY_MS = 3_600_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** When each store last sent a heartbeat from this process, so several clients for one store share the daily beat. */
const lastHeartbeat = new Map<string, number>();
const heartbeatInFlight = new Set<string>();

export interface PepReviewProOptions {
	/** The store's slug, like `example-store`. */
	store: string;
	/** Secret and server only. Defaults to `PEPREVIEWPRO_API_KEY`. Public reads work without one. */
	apiKey?: string | undefined;
	/** The endpoint's `whsec_…` secret. Defaults to `PEPREVIEWPRO_WEBHOOK_SECRET`. */
	webhookSecret?: string | undefined;
	/** Defaults to `PEPREVIEWPRO_BASE_URL`, then https://pepreviewpro.com. */
	baseUrl?: string | undefined;
	fetch?: typeof fetch | undefined;
	/** Retries after the first attempt on 429, 5xx, and network failures. Default 3. */
	maxRetries?: number | undefined;
	timeoutMs?: number | undefined;
	/**
	 * Sends a heartbeat once a day per process, after the first call that works, so the dashboard's **Connection** card
	 * shows the SDK. `false` turns it off. Declare `capabilities` here for a full card from the first beat.
	 */
	heartbeat?: boolean | HeartbeatOptions | undefined;
	/** Keeps a serverless function alive for the background heartbeat, like Vercel's `waitUntil`. */
	waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
}

export interface ReviewsListOptions {
	/** The store's own product id. Leave out for the whole store. */
	productRef?: ExternalId | undefined;
	/** 1 to 50. Default 20. */
	limit?: number | undefined;
	signal?: AbortSignal | undefined;
}

/** One store's reviews as the widgets render them. Pass it to the React components to skip a second fetch. */
export type ReviewsList = WidgetData;

export interface ReviewsSyncOptions {
	/** Only reviews created or changed since then, oldest change first. */
	updatedSince?: DateInput | undefined;
	/** `nextCursor` from the previous page. Send the same other options with it. */
	cursor?: string | null | undefined;
	/** The store's own product id. Narrows the reviews and the aggregate. */
	productRef?: ExternalId | undefined;
	/** 1 to 100. Default 20. */
	limit?: number | undefined;
	signal?: AbortSignal | undefined;
}

export interface ReviewsSyncPage {
	reviews: MyReview[];
	/** Null on the last page. */
	nextCursor: string | null;
	aggregate: MyReviewsAggregate;
}

export type ProductJsonLdOptions = Omit<ProductJsonLdInput, "reviews" | "aggregate" | "minRating"> & {
	productRef?: ExternalId | undefined;
	/** The `reviews.list` result already fetched for the page, so the markup and the widget show the same numbers. */
	data?: ReviewsList | undefined;
	signal?: AbortSignal | undefined;
};

/**
 * The server side of PepReviewPro for a store on any stack: orders, imports, catalog, reviews for server rendering,
 * JSON-LD, webhooks, and the heartbeat. Holds the store's secret key, so it never runs in a browser.
 */
export class PepReviewPro {
	readonly store: string;
	readonly #client: PepReviewProClient;
	readonly #webhookSecret: string | undefined;
	readonly #heartbeat: HeartbeatOptions | false;
	readonly #waitUntil: ((promise: Promise<unknown>) => void) | undefined;
	readonly #framework: string;
	readonly #observed = new Set<Capability>();

	constructor(options: PepReviewProOptions) {
		const store = options.store?.trim();
		if (!store) {
			throw new TypeError("Pass store, the store's slug, like `example-store`.");
		}

		if (UUID.test(store)) {
			throw new TypeError("Pass store as the store's slug, like `example-store`, not its id.");
		}

		const env = readEnv();
		const baseUrl = options.baseUrl ?? env.baseUrl;
		this.store = store;
		this.#client = new PepReviewProClient({
			apiKey: options.apiKey ?? env.apiKey,
			userAgent: `pepreviewpro-sdk/${VERSION} (${detectRuntime()})`,
			...(baseUrl ? { baseUrl } : {}),
			...(options.fetch ? { fetch: options.fetch } : {}),
			...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
			...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
		});
		this.#webhookSecret = options.webhookSecret ?? env.webhookSecret;
		this.#heartbeat = options.heartbeat === false ? false : options.heartbeat === true || !options.heartbeat ? {} : options.heartbeat;
		this.#waitUntil = options.waitUntil;
		this.#framework = (this.#heartbeat && this.#heartbeat.framework) || (env.nextRuntime ? "next" : "unknown");
	}

	readonly orders = {
		/**
		 * Sends one order or many, as created or updated. Repeating an order is safe: it comes back `unchanged`.
		 * Given the checkout `request`, fills attribution, reviews seen, IP, and user agent from it.
		 */
		upsert: ((orders: Order | Order[], options: UpsertOptions = {}) => this.#upsert(orders, options)) as {
			(order: Order, options?: UpsertOptions): Promise<OrderOutcome>;
			(orders: Order[], options?: UpsertOptions): Promise<OrderOutcome[]>;
		},

		/**
		 * Sends past orders in batches of 200 without queuing email, unless `sendEmail` is set. Resumable: save the
		 * `checkpoint` from `onProgress`, or from the `ImportError` a failed batch throws, and pass it back.
		 */
		import: (source: AsyncIterable<Order> | Iterable<Order>, options: ImportOptions = {}): Promise<ImportTotals & { checkpoint: ImportCheckpoint }> =>
			importOrders(source, options, async (batch) => {
				const response = await this.#client.orders(
					{ store: this.store, import: !options.sendEmail, orders: batch.map((order) => this.#toInput(order, null)) },
					{ signal: options.signal }
				);
				this.#afterCall();
				return response.results.map(toOrderOutcome);
			})
	};

	readonly catalog = {
		/** Replaces the store's catalog on PepReviewPro, and its shipping and payment methods when sent. */
		push: async (input: CatalogInput, options: { signal?: AbortSignal | undefined } = {}): Promise<CatalogOutcome> => {
			this.#observed.add("catalog");
			const { products, mapped, skipped } = await this.#client.catalog(
				{
					store: this.store,
					products: input.products.map((product) => ({
						id: product.id,
						name: product.name,
						short_description: product.shortDescription ?? null,
						url: product.url ?? null,
						image_url: product.imageUrl ?? null,
						price_min: product.priceMin ?? null,
						price_max: product.priceMax ?? null,
						currency: product.currency ?? null,
						in_stock: product.inStock ?? null
					})),
					...(input.shipsTo ? { ships_to: input.shipsTo } : {}),
					...(input.shipsFrom ? { ships_from: input.shipsFrom } : {}),
					...(input.paymentMethods ? { payment_methods: input.paymentMethods } : {})
				},
				{ signal: options.signal }
			);
			this.#afterCall();
			return { products, mapped, skipped };
		}
	};

	readonly reviews = {
		/**
		 * The store's reviews, aggregate, and widget settings for server rendering. Reads public `widget-data`, so
		 * page renders never count against the key's limits.
		 */
		list: async (options: ReviewsListOptions = {}): Promise<ReviewsList> => {
			const { store, settings, reviews, aggregate } = await this.#client.widgetData(
				{ site_id: this.store, ...refQuery("product", options.productRef), ...(options.limit === undefined ? {} : { limit: options.limit }) },
				{ signal: options.signal }
			);
			this.#afterCall();
			return { store, settings, reviews, aggregate };
		},

		/** One page of approved reviews for stores that mirror them into their own database. Follow `nextCursor`. */
		sync: async (options: ReviewsSyncOptions = {}): Promise<ReviewsSyncPage> => {
			const updatedSince = toIsoString(options.updatedSince, "updatedSince");
			const query: MyReviewsQuery = {
				store: this.store,
				...(options.productRef === undefined ? {} : { product_ref: String(options.productRef) }),
				...(updatedSince ? { updated_since: updatedSince } : {}),
				...(options.limit === undefined ? {} : { limit: options.limit }),
				...(options.cursor ? { cursor: options.cursor } : {})
			};
			const response = await this.#client.myReviews(query, { signal: options.signal });
			this.#afterCall();
			return { reviews: response.reviews, nextCursor: response.next_cursor, aggregate: response.aggregate };
		},

		/** Every review `sync` would page through, fetched a page at a time as the loop goes on. */
		syncAll: (options: ReviewsSyncOptions = {}): AsyncGenerator<MyReview, void, undefined> =>
			paginate(async (cursor) => {
				const page = await this.reviews.sync({ ...options, cursor });
				return { items: page.reviews, nextCursor: page.nextCursor };
			}, options.cursor ?? null)
	};

	readonly jsonLd = {
		/**
		 * schema.org Product markup with the store's AggregateRating and up to 10 Review nodes, from the same
		 * `widget-data` the widget shows. Null when the product has no reviews and no offers were passed.
		 */
		product: async ({ productRef, data, signal, ...product }: ProductJsonLdOptions): Promise<ProductJsonLd | null> => {
			this.#observed.add("jsonLd");
			const list = data ?? (await this.reviews.list({ productRef, limit: 20, signal }));
			return productJsonLd({ ...product, reviews: list.reviews, aggregate: list.aggregate, minRating: list.settings?.min_rating_display });
		}
	};

	readonly webhooks = {
		/** Checks a delivery's signature and returns its event. Throws `WebhookVerificationError` on a bad one. */
		verify: async (
			rawBody: string | Uint8Array,
			headers: Parameters<typeof verifyWebhook>[1],
			options: { toleranceSeconds?: number; now?: number } = {}
		): Promise<WebhookEvent> => {
			if (!this.#webhookSecret) {
				throw new Error("Pass webhookSecret, or set PEPREVIEWPRO_WEBHOOK_SECRET to the endpoint's whsec_ secret.");
			}

			const event = await verifyWebhook(rawBody, headers, { secret: this.#webhookSecret, ...options });
			this.#observed.add("webhooks");
			return event;
		}
	};

	/** Tells the **Connection** card the SDK is running, which version, and what it does. */
	async heartbeat(options: HeartbeatOptions = {}): Promise<{ receivedAt: string }> {
		const declared = this.#heartbeat ? this.#heartbeat : {};
		const capabilities = new Set<Capability>([...(declared.capabilities ?? []), ...this.#observed, ...(options.capabilities ?? [])]);
		const response = await this.#client.heartbeat({
			store: this.store,
			sdk_version: VERSION,
			packages: { "@pepreviewpro/core": CORE_VERSION, "@pepreviewpro/server": VERSION, ...declared.packages, ...options.packages },
			framework: options.framework ?? this.#framework,
			runtime: detectRuntime(),
			capabilities: [...capabilities]
		});
		lastHeartbeat.set(this.#heartbeatKey, Date.now());
		return { receivedAt: response.received_at };
	}

	/** The key's type, scopes, and this month's usage. Never rate limited. */
	async me(options: { signal?: AbortSignal | undefined } = {}): Promise<ApiKeyInfo> {
		return toApiKeyInfo(await this.#client.me({ signal: options.signal }));
	}

	get #heartbeatKey(): string {
		return `${this.#client.baseUrl} ${this.store}`;
	}

	async #upsert(orders: Order | Order[], options: UpsertOptions): Promise<OrderOutcome | OrderOutcome[]> {
		const list = Array.isArray(orders) ? orders : [orders];
		const context = options.request ? readRequestContext(options.request) : null;
		const merged: RequestContext | null =
			context || options.context
				? {
						ip: context?.ip ?? null,
						userAgent: context?.userAgent ?? null,
						attribution: options.context?.attribution ?? context?.attribution ?? null,
						reviewsSeenAt: options.context?.reviews_seen_at ?? context?.reviewsSeenAt ?? null
					}
				: null;
		const outcomes: OrderOutcome[] = [];
		const batches = chunk(list, MAX_ORDERS_PER_REQUEST);
		for (const [index, batch] of batches.entries()) {
			const response = await this.#client.orders(
				{ store: this.store, import: false, orders: batch.map((order) => this.#toInput(order, merged)) },
				{
					idempotencyKey: options.idempotencyKey && batches.length > 1 ? `${options.idempotencyKey}:${index}` : options.idempotencyKey,
					signal: options.signal
				}
			);
			outcomes.push(...response.results.map(toOrderOutcome));
		}

		this.#afterCall();
		return Array.isArray(orders) ? outcomes : (outcomes[0] as OrderOutcome);
	}

	#toInput(order: Order, context: RequestContext | null) {
		const input = toOrderInput(order, context ?? { attribution: null, reviewsSeenAt: null, ip: null, userAgent: null });
		this.#observed.add("orders");
		if (input.attribution) {
			this.#observed.add("attribution");
		}

		if (input.reviews_seen_at) {
			this.#observed.add("reviewsSeen");
		}

		return input;
	}

	/** Starts the daily heartbeat in the background once a call has worked. Its failure never reaches the caller. */
	#afterCall(): void {
		const key = this.#heartbeatKey;
		const last = lastHeartbeat.get(key);
		if (!this.#heartbeat || !this.#client.hasApiKey || heartbeatInFlight.has(key) || (last !== undefined && Date.now() - last < DAY_MS)) {
			return;
		}

		heartbeatInFlight.add(key);
		const beat = this.heartbeat()
			.catch(() => lastHeartbeat.set(key, Date.now() - DAY_MS + RETRY_MS))
			.finally(() => heartbeatInFlight.delete(key));
		this.#waitUntil?.(beat);
	}
}
