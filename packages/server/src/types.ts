import type { CheckoutContext } from "@pepreviewpro/browser";
import type { Attribution, Capability, ExternalId, OrderResultStatus, OrderStatus, PaymentMethod } from "@pepreviewpro/core";

export type DateInput = Date | string;

export interface LineItem {
	/** The store's own product id. Strings like `sku-101` are fine. */
	productId: ExternalId;
	variationId?: ExternalId | null | undefined;
	name?: string | null | undefined;
	quantity?: number | null | undefined;
	total?: number | null | undefined;
}

export interface Order {
	/** The store's own order id, like `ORD-1001`. Repeating an id updates that order. */
	id: ExternalId;
	/** Requests are queued on the store's trigger status, `completed` unless it chose `paid`. */
	status: OrderStatus;
	email?: string | null | undefined;
	name?: string | null | undefined;
	customerId?: ExternalId | null | undefined;
	total?: number | null | undefined;
	currency?: string | null | undefined;
	/** The first item names the review request. */
	lineItems?: LineItem[] | undefined;
	createdAt?: DateInput | null | undefined;
	paidAt?: DateInput | null | undefined;
	completedAt?: DateInput | null | undefined;
	/** From `@pepreviewpro/browser`. Read from the request's cookie when left out. */
	attribution?: Attribution | null | undefined;
	/** Read from the request when left out. Hashed on arrival. */
	customerIp?: string | null | undefined;
	customerUserAgent?: string | null | undefined;
	/** Unix seconds or a Date. Read from the request's cookie when left out. */
	reviewsSeenAt?: number | Date | null | undefined;
}

export interface OrderOutcome {
	/** Your id, as a string even when you sent a number. */
	id: string;
	status: OrderResultStatus;
	/** Review requests queued for this order by this call. */
	queued: number;
	duplicates: number;
	/** Why no request was queued, like `import`, `not_trigger_status`, `nothing_to_email`, or `no_active_campaign`. */
	skippedReason?: string;
}

/** A Fetch `Request`, or anything with its headers, like an Express or Node request. */
export type RequestLike = { headers: HeadersLike };

export type HeadersLike = Headers | Record<string, string | string[] | undefined>;

export interface UpsertOptions {
	/** The checkout request. Its cookies, IP, and user agent fill the fields an order leaves out. */
	request?: RequestLike | undefined;
	/** What `readCheckoutContext()` returned in the browser, when checkout runs on another host. */
	context?: CheckoutContext | undefined;
	idempotencyKey?: string | undefined;
	signal?: AbortSignal | undefined;
}

export interface ImportCheckpoint {
	/** Orders from the start of the source already sent. Resuming skips this many. */
	processed: number;
}

export interface ImportTotals {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	queued: number;
}

export interface ImportProgress extends ImportTotals {
	/** The outcomes of the batch just sent. */
	batch: OrderOutcome[];
	/** Save this to resume after a crash. */
	checkpoint: ImportCheckpoint;
}

export interface ImportOptions {
	/**
	 * Queue review requests for orders that reach the trigger status. Off by default, which makes it a backfill.
	 * The daily re-send turns it on.
	 */
	sendEmail?: boolean | undefined;
	/** Where an earlier run stopped. */
	checkpoint?: ImportCheckpoint | null | undefined;
	/** 1 to 200. Default 200. */
	batchSize?: number | undefined;
	onProgress?: ((progress: ImportProgress) => void | Promise<void>) | undefined;
	signal?: AbortSignal | undefined;
}

export interface CatalogProduct {
	id: ExternalId;
	name: string;
	shortDescription?: string | null | undefined;
	url?: string | null | undefined;
	imageUrl?: string | null | undefined;
	priceMin?: number | null | undefined;
	priceMax?: number | null | undefined;
	currency?: string | null | undefined;
	inStock?: boolean | null | undefined;
}

export interface CatalogInput {
	/** Up to 5,000. The whole catalog, every time. */
	products: CatalogProduct[];
	/** Two-letter country codes. Leave out to keep the list on PepReviewPro as it is. */
	shipsTo?: string[] | undefined;
	shipsFrom?: string | undefined;
	paymentMethods?: PaymentMethod[] | undefined;
}

export interface CatalogOutcome {
	products: number;
	mapped: number;
	skipped: number;
}

export interface HeartbeatOptions {
	/** Like `next@16.4.2`. */
	framework?: string | undefined;
	capabilities?: Capability[] | undefined;
	/** Other `@pepreviewpro/*` packages in use, by name and version. */
	packages?: Record<string, string> | undefined;
}
