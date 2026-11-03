import { MAX_PARTNER_EVENTS, MAX_VENDOR_MISS_NAME, MAX_VENDOR_MISS_QUESTION, PepReviewProClient, type CatalogFilterQuery } from "@pepreviewpro/core";
import { chunk } from "./chunk";
import { clampText } from "./clampText";
import { detectRuntime } from "./detectRuntime";
import type {
	ApiKeyInfo,
	BackgroundOptions,
	ClickLinkOptions,
	DirectoryEvent,
	DirectoryFilters,
	DirectoryProduct,
	DirectoryProductsOptions,
	DirectoryProductsPage,
	DirectoryReview,
	DirectoryReviewsOptions,
	DirectoryReviewsPage,
	DirectoryStore,
	DirectoryStoresOptions,
	DirectoryStoresPage,
	EventsOutcome,
	ForegroundOptions,
	PageOptions,
	VendorMissInput,
	VendorMissOutcome
} from "./directoryTypes";
import { isOnStoreSite } from "./isOnStoreSite";
import { paginate } from "./paginate";
import { VERSION } from "./PepReviewPro";
import { readEnv } from "./readEnv";
import { toApiKeyInfo } from "./toApiKeyInfo";
import { toAppliedFilters } from "./toAppliedFilters";
import { toDirectoryProduct } from "./toDirectoryProduct";
import { toDirectoryReview } from "./toDirectoryReview";
import { toDirectoryStore } from "./toDirectoryStore";

const MAX_VENDOR_MISS_URL = 500;

export interface PepReviewProPartnerOptions {
	/** Your partner key. Secret and server only. Defaults to `PEPREVIEWPRO_API_KEY`. */
	apiKey?: string | undefined;
	/** Defaults to `PEPREVIEWPRO_BASE_URL`, then https://pepreviewpro.com. */
	baseUrl?: string | undefined;
	fetch?: typeof fetch | undefined;
	/** Retries after the first attempt. Default 2, since a page or a chat turn is waiting. */
	maxRetries?: number | undefined;
	/** Per attempt. Default 10,000. */
	timeoutMs?: number | undefined;
	/** Keeps a serverless function alive for `background` reports, like Vercel's `waitUntil`. */
	waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
}

/**
 * A store or product to link: anything with a `clickUrl`, and the store website `/go/` checks `to` against. A
 * product carries its store's.
 */
export type ClickTarget =
	{ clickUrl: string | null; websiteUrl?: string | null | undefined } | { clickUrl: string | null; store: { websiteUrl: string | null } };

/** The fields that have a value, so a query or event never carries an empty one. */
const defined = <Value extends object>(value: Value) =>
	Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "")) as {
		[Key in keyof Value]?: Exclude<Value[Key], null | undefined>;
	};

function toFilterQuery({ compound, shipsTo, payment, inStock, minRating }: DirectoryFilters): CatalogFilterQuery {
	return defined({ compound, ships_to: shipsTo?.toUpperCase(), payment, in_stock: inStock, min_rating: minRating });
}

/** Last in the query, as the API's own examples write it. */
const toPageQuery = ({ limit, cursor }: PageOptions) => defined({ limit, cursor });

/**
 * The server side of PepReviewPro for a directory partner: a site or an assistant that lists PepReviewPro stores.
 * Reads the directory, reports what it showed and the stores it could not, and builds tracked links. Holds your
 * secret partner key, so it never runs in a browser. Takes no store: a partner reads them all.
 */
export class PepReviewProPartner {
	readonly #client: PepReviewProClient;
	readonly #waitUntil: ((promise: Promise<unknown>) => void) | undefined;

	constructor(options: PepReviewProPartnerOptions = {}) {
		const env = readEnv();
		const baseUrl = options.baseUrl ?? env.baseUrl;
		this.#client = new PepReviewProClient({
			apiKey: options.apiKey ?? env.apiKey,
			userAgent: `pepreviewpro-sdk/${VERSION} partner (${detectRuntime()})`,
			maxRetries: options.maxRetries ?? 2,
			timeoutMs: options.timeoutMs ?? 10_000,
			maxDelayMs: 2_000,
			maxRetryAfterMs: 5_000,
			...(baseUrl ? { baseUrl } : {}),
			...(options.fetch ? { fetch: options.fetch } : {})
		});
		this.#waitUntil = options.waitUntil;
	}

	readonly stores = {
		/**
		 * One page of the directory, ranked. With `compound`, only stores that carry it, each with up to three
		 * `matchedProducts` and a `matchedProductCount`. Each store returned counts as served to you in its insights.
		 */
		list: async (options: DirectoryStoresOptions = {}): Promise<DirectoryStoresPage> => {
			const { search, sort, signal } = options;
			const response = await this.#client.stores({ ...toFilterQuery(options), ...defined({ search, sort }), ...toPageQuery(options) }, { signal });
			const filters = toAppliedFilters(response.filters);
			return {
				stores: response.stores.map(toDirectoryStore),
				total: response.total,
				nextCursor: response.next_cursor,
				filters,
				unknownCompound: filters.unknownCompound
			};
		},

		/** Every store `list` would page through, fetched a page at a time as the loop goes on. */
		iterate: (options: DirectoryStoresOptions = {}): AsyncGenerator<DirectoryStore, void, undefined> =>
			paginate(async (cursor) => {
				const page = await this.stores.list({ ...options, cursor });
				return { items: page.stores, nextCursor: page.nextCursor };
			}, options.cursor ?? null)
	};

	readonly products = {
		/** One page of the products that map to one compound, each with its store. `stores` filters before paging. */
		list: async (options: DirectoryProductsOptions): Promise<DirectoryProductsPage> => {
			const { sort, stores, signal } = options;
			const response = await this.#client.products(
				{
					...toFilterQuery(options),
					compound: options.compound,
					...defined({ store: stores?.join(","), sort }),
					...toPageQuery(options)
				},
				{ signal }
			);
			const filters = toAppliedFilters(response.filters);
			return {
				products: response.products.map(toDirectoryProduct),
				total: response.total,
				nextCursor: response.next_cursor,
				filters,
				unknownCompound: filters.unknownCompound
			};
		},

		/** Every product `list` would page through, fetched a page at a time as the loop goes on. */
		iterate: (options: DirectoryProductsOptions): AsyncGenerator<DirectoryProduct, void, undefined> =>
			paginate(async (cursor) => {
				const page = await this.products.list({ ...options, cursor });
				return { items: page.products, nextCursor: page.nextCursor };
			}, options.cursor ?? null)
	};

	readonly reviews = {
		/** One page of approved reviews across the directory, or one store's, newest first. Needs `reviews:read`. */
		list: async (options: DirectoryReviewsOptions = {}): Promise<DirectoryReviewsPage> => {
			const { store, minRating, signal } = options;
			const response = await this.#client.reviews({ ...defined({ store, min_rating: minRating }), ...toPageQuery(options) }, { signal });
			return { reviews: response.reviews.map(toDirectoryReview), nextCursor: response.next_cursor };
		},

		/** Every review `list` would page through, fetched a page at a time as the loop goes on. */
		iterate: (options: DirectoryReviewsOptions = {}): AsyncGenerator<DirectoryReview, void, undefined> =>
			paginate(async (cursor) => {
				const page = await this.reviews.list({ ...options, cursor });
				return { items: page.reviews, nextCursor: page.nextCursor };
			}, options.cursor ?? null)
	};

	readonly vendorMiss = {
		/**
		 * Tells PepReviewPro your user asked about a store you could not show, so it can invite the store. Trims and
		 * cuts `name`, `url`, and `question` to what the API keeps. Sent with an `Idempotency-Key`, so a retry is never
		 * counted twice.
		 */
		report: ((input: VendorMissInput, options?: ForegroundOptions | BackgroundOptions) => {
			const send = (signal?: AbortSignal) => this.#reportMiss(input, signal);
			return options?.background ? this.#background(send, options) : send(options?.signal);
		}) as {
			(input: VendorMissInput, options?: ForegroundOptions): Promise<VendorMissOutcome>;
			(input: VendorMissInput, options: BackgroundOptions): void;
		}
	};

	readonly events = {
		/**
		 * Tells PepReviewPro which stores you showed, and the visits you sent by a link other than `clickUrl`. Sent in
		 * batches of 50. Until your first `shown` event, your reads count as your impressions; from then on only `shown`
		 * events do, so once you send them, send one for every store you show. Each event keeps one `id` and each batch
		 * one `Idempotency-Key` across retries, so a retry is never counted twice.
		 */
		report: ((events: readonly DirectoryEvent[], options?: ForegroundOptions | BackgroundOptions) => {
			const send = (signal?: AbortSignal) => this.#reportEvents(events, signal);
			return options?.background ? this.#background(send, options) : send(options?.signal);
		}) as {
			(events: readonly DirectoryEvent[], options?: ForegroundOptions): Promise<EventsOutcome>;
			(events: readonly DirectoryEvent[], options: BackgroundOptions): void;
		}
	};

	readonly links = {
		/**
		 * The link to send a buyer to a store or product: its `clickUrl`, which credits you. With `to`, the buyer lands
		 * on that page instead, still through the tracked link, when it is on the store's own website or a subdomain.
		 * Otherwise `to` is left off, since `/go/` would ignore it. Null when the target has no `clickUrl`, which is the
		 * case on a key no partner is linked to.
		 */
		click: (target: ClickTarget, options: ClickLinkOptions = {}): string | null => {
			if (!target.clickUrl) {
				return null;
			}

			const site = "store" in target ? target.store.websiteUrl : target.websiteUrl;
			if (!options.to || !site || !isOnStoreSite(options.to, site)) {
				return target.clickUrl;
			}

			const url = new URL(target.clickUrl);
			url.searchParams.set("to", options.to);
			return url.toString();
		}
	};

	/** Your key's scopes and this month's usage. Never rate limited, though it counts toward the month. */
	async me(options: { signal?: AbortSignal | undefined } = {}): Promise<ApiKeyInfo> {
		return toApiKeyInfo(await this.#client.me({ signal: options.signal }));
	}

	async #reportMiss(input: VendorMissInput, signal: AbortSignal | undefined): Promise<VendorMissOutcome> {
		const name = clampText(input.name ?? "", MAX_VENDOR_MISS_NAME);
		if (!name) {
			throw new TypeError("Pass name, the store's name as your user wrote it.");
		}

		const url = input.url ? clampText(input.url, MAX_VENDOR_MISS_URL) : "";
		const question = input.question ? clampText(input.question, MAX_VENDOR_MISS_QUESTION) : "";
		const response = await this.#client.vendorMiss({ name, ...(url ? { url } : {}), ...(question ? { question } : {}) }, { signal });
		return { inDirectory: response.in_directory, listedWithPartners: response.listed_with_partners };
	}

	async #reportEvents(events: readonly DirectoryEvent[], signal: AbortSignal | undefined): Promise<EventsOutcome> {
		const outcome: EventsOutcome = { recorded: 0, duplicates: 0, skipped: 0 };
		for (const batch of chunk(events, MAX_PARTNER_EVENTS)) {
			const response = await this.#client.partnerEvents(
				{
					events: batch.map((event) => ({
						type: event.type,
						store: event.store,
						...defined({ id: event.id, product_ref: event.productRef, compound: event.compound, placement: event.placement })
					}))
				},
				{ signal }
			);
			outcome.recorded += response.recorded;
			outcome.duplicates += response.duplicates;
			outcome.skipped += response.skipped;
		}

		return outcome;
	}

	#background(send: () => Promise<unknown>, options: BackgroundOptions): void {
		const sent = Promise.resolve()
			.then(send)
			.then(
				() => undefined,
				(error: unknown) => {
					try {
						options.onError?.(error);
					} catch {
						// A failing error handler must not turn a report into an unhandled rejection.
					}
				}
			);
		this.#waitUntil?.(sent);
	}
}
