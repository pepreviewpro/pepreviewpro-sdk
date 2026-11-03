/**
 * Wire shapes of https://pepreviewpro.com/api/v1, hand-written for 0.x. Field names are the API's own, snake_case,
 * because these cross the wire unchanged. `scripts/codegen` checks every required field here against the app's
 * documented response examples, so a field the API drops fails CI here.
 */

/** A store's own order or product id: a positive integer, or any non-empty string up to 200 characters. */
export type ExternalId = number | string;

export type OrderStatus = "pending" | "paid" | "completed" | "refunded" | "cancelled";

export type Capability = "orders" | "attribution" | "reviewsSeen" | "catalog" | "webhooks" | "jsonLd";

/** Values from the app's `lib/enums/site.ts` payment methods. */
export type PaymentMethod = "card" | "crypto" | "bankTransfer" | "zelle" | "cashApp" | "venmo" | "paypal" | "other";

/** Star counts keyed "1" to "5". */
export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

/** What `@pepreviewpro/browser` captures on the first landing, sent with the order. */
export interface Attribution {
	/** The landing page with its query string. The server finds `prp_click_id` in it. */
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

export interface OrderLineItemInput {
	product_id: ExternalId;
	variation_id?: ExternalId | null;
	name?: string | null;
	quantity?: number | null;
	total?: number | null;
}

export interface OrderInput {
	id: ExternalId;
	status: OrderStatus;
	email?: string | null;
	name?: string | null;
	customer_id?: ExternalId | null;
	total?: number | null;
	currency?: string | null;
	line_items?: OrderLineItemInput[];
	created_at?: string | null;
	paid_at?: string | null;
	completed_at?: string | null;
	attribution?: Attribution | null;
	customer_ip?: string | null;
	customer_user_agent?: string | null;
	/** Unix seconds. */
	reviews_seen_at?: number | null;
}

export interface OrdersRequest {
	/** The store's slug. */
	store: string;
	/** `true` is a backfill: rows are written and credited, no email is queued. */
	import?: boolean;
	/** 1 to 200. */
	orders: OrderInput[];
}

export type OrderResultStatus = "created" | "updated" | "unchanged";

export interface OrderResult {
	/** The caller's id, as a string even when it was sent as a number. */
	id: string;
	status: OrderResultStatus;
	queued: number;
	duplicates: number;
	/** Present only when a request was not queued, like `import`, `not_trigger_status`, `nothing_to_email`, or `no_active_campaign`. */
	skipped_reason?: string;
}

export interface OrdersResponse {
	store: string;
	results: OrderResult[];
}

export interface CatalogProductInput {
	id: ExternalId;
	name: string;
	short_description?: string | null;
	url?: string | null;
	image_url?: string | null;
	price_min?: number | null;
	price_max?: number | null;
	currency?: string | null;
	in_stock?: boolean | null;
}

export interface CatalogRequest {
	/** The store's slug. */
	store: string;
	/** 0 to 5,000. Malformed items are skipped by the server, not fatal. */
	products: CatalogProductInput[];
	/** ISO 3166-1 alpha-2 codes. Omitted leaves the store's list as it is. */
	ships_to?: string[];
	ships_from?: string;
	payment_methods?: PaymentMethod[];
}

export interface CatalogResponse {
	store: string;
	products: number;
	mapped: number;
	skipped: number;
}

export interface HeartbeatRequest {
	/** The store's slug. */
	store: string;
	sdk_version: string;
	packages: Record<string, string>;
	framework: string;
	runtime: string;
	capabilities: Capability[];
}

export interface HeartbeatResponse {
	store: string;
	received_at: string;
}

/** A review as `widget-data` shapes it. */
export interface WidgetReview {
	id: string;
	reviewer_name: string;
	rating: number;
	title: string | null;
	body: string;
	is_verified: boolean;
	created_at: string;
	/** The store's own product id the review is for, as a string even when it was sent as a number, or null. */
	product_ref: string | null;
	/** Always null from public `widget-data`, which would otherwise publish order numbers. Filled on `my-reviews`. */
	order_ref: string | null;
	updated_at: string;
}

export interface WidgetStore {
	id: string;
	slug: string | null;
	name: string;
	accent_color: string | null;
	widget_logo_url: string | null;
	public_page_enabled: boolean;
	app_url: string;
}

export interface WidgetSettings {
	theme: "light" | "dark" | "auto";
	autoplay_speed: number;
	ticker_speed: number;
	show_aggregate: boolean;
	show_distribution: boolean;
	show_verified_badge: boolean;
	min_rating_display: number;
	cache_bust_token: string | null;
}

export interface WidgetAggregate {
	average_rating: number;
	/** The PepReviewPro score, which the widgets headline. */
	score: number;
	total: number;
	distribution: RatingDistribution;
}

export interface WidgetDataResponse {
	success: true;
	requested_site_id: string;
	resolved_site_id: string;
	store: WidgetStore;
	/** Null until the store saves its widget settings. */
	settings: WidgetSettings | null;
	reviews: WidgetReview[];
	aggregate: WidgetAggregate;
}

/** What every widget renders: one store's `widget-data`, without the request echo. */
export type WidgetData = Pick<WidgetDataResponse, "store" | "settings" | "reviews" | "aggregate">;

export interface WidgetDataQuery {
	/** The store's slug. */
	site_id: string;
	/** A WooCommerce-style integer product id. */
	product_id?: number;
	/** The store's own product id, string or integer. */
	product_ref?: ExternalId;
	/** 1 to 50. */
	limit?: number;
}

export interface StoreProfileResponse {
	success: true;
	requested_site_id: string;
	resolved_site_id: string;
	store: {
		id: string;
		slug: string;
		name: string;
		wp_url: string | null;
		logo_url: string | null;
		widget_logo_url: string | null;
		banner_url: string | null;
		accent_color: string | null;
		business_description: string | null;
	};
	/** Null until the store saves its widget settings. */
	widget_settings: Record<string, unknown> | null;
}

/** A review as the keyed endpoints send it. Times are ISO 8601 UTC with milliseconds, like `2026-10-03T14:21:07.512Z`. */
export interface ApiReview {
	/** A UUID. */
	id: string;
	/** The store's slug. */
	store: string;
	/** The store's own product id, as a string even when it was sent as a number, or null. */
	product_ref: string | null;
	rating: number;
	title: string | null;
	body: string;
	/** Already shortened, like "Sam R.". */
	author: string;
	/** Matched to an order. */
	verified: boolean;
	created_at: string;
	updated_at: string;
}

/** A review on the owner's `my-reviews`, which also names the order. */
export interface MyReview extends ApiReview {
	/** The store's own order id, as a string, or null. */
	order_ref: string | null;
}

export type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

/** `cursor` is the previous page's `next_cursor`. Send the same other parameters with it. */
export interface PageQuery {
	/** 1 to 100. Default 20. Anything else is a 400. */
	limit?: number;
	cursor?: string;
}

export interface MyReviewsQuery extends PageQuery {
	/** The store's slug. Required when the key reaches more than one store. */
	store?: string;
	/** The store's own product id. Narrows the reviews and the aggregate. */
	product_ref?: ExternalId;
	/** 0 to 5. */
	min_rating?: number;
	verified_only?: boolean;
	/** Ignored with `updated_since`. */
	sort?: ReviewSort;
	/** ISO 8601. Only reviews changed since then, oldest change first. */
	updated_since?: string;
}

export interface MyReviewsAggregate {
	/** The average star rating. */
	rating: number;
	review_count: number;
	verified_review_count: number;
	distribution: RatingDistribution;
}

export interface MyReviewsResponse {
	reviews: MyReview[];
	aggregate: MyReviewsAggregate;
	/** Null on the last page. */
	next_cursor: string | null;
}

export interface MyStoresQuery extends PageQuery {
	/** One store's slug. */
	store?: string;
}

/** The fields every store object on the wire shares. */
export interface ApiStoreBase {
	slug: string;
	name: string;
	description: string | null;
	/** The store's own website, untracked. */
	website_url: string | null;
	logo_url: string | null;
	accent_color: string | null;
	/** The average star rating. */
	rating: number;
	review_count: number;
	verified_review_count: number;
	ships_from: string | null;
	/** Empty when the store has not listed its countries, which means unknown, not nowhere. */
	ships_to: string[];
	payment_methods: PaymentMethod[];
	coa_url: string | null;
	/** ISO 8601, or null before the first catalog sync. */
	catalog_synced_at: string | null;
}

/** A store the key reaches, from `my-stores`. */
export interface MyStore extends ApiStoreBase {
	rating_distribution: RatingDistribution;
	widget_logo_url: string | null;
	banner_url: string | null;
	public_page_enabled: boolean;
	/** The store's PepReviewPro page. Null while the public page is off. */
	profile_url: string | null;
	/** Null until the store saves its widget settings. */
	widget_settings: MyStoreWidgetSettings | null;
}

export interface MyStoreWidgetSettings {
	theme: "light" | "dark" | "auto";
	display_mode: string;
	autoplay_speed: number;
	transition_type: string;
	show_aggregate: boolean;
	show_distribution: boolean;
	show_dates: boolean;
	show_verified_badge: boolean;
	min_rating_display: number;
	ticker_speed: number;
}

export interface MyStoresResponse {
	stores: MyStore[];
	next_cursor: string | null;
}

export interface SubmitReviewRequest {
	/** The store's id or slug, or `"demo"` for a form that saves nothing. */
	site_id: string;
	reviewer_name: string;
	reviewer_email: string;
	rating: number;
	body: string;
	title?: string | null;
	product_id?: number | null;
	order_id?: number | null;
	product_ref?: ExternalId | null;
	order_ref?: ExternalId | null;
}

export interface SubmitReviewResponse {
	success: true;
	message: string;
	review_id: string;
}

export type WebhookEventType = "ping" | "review.published" | "review.updated" | "review.deleted" | "store.updated" | "aggregate.changed";

export interface WebhookEnvelope<Type extends WebhookEventType, Data> {
	/** The `webhook-id` header. Use it to drop repeats: a delivery can arrive more than once. */
	id: string;
	type: Type;
	/** ISO 8601. */
	timestamp: string;
	/** Every event names its store by slug, so one handler can serve several. */
	data: Data & { store: string };
}

/**
 * An outbound webhook's body, after its signature checks out. Deliveries can arrive out of order, so treat one as a
 * signal to refetch, not as the truth to cache. `updated_at` on a review allows last-write-wins for stores that mirror.
 */
export type WebhookEvent =
	| WebhookEnvelope<"ping", Record<string, never>>
	| WebhookEnvelope<"review.published" | "review.updated", WidgetReview>
	| WebhookEnvelope<"review.deleted", { id: string }>
	| WebhookEnvelope<"store.updated", { branding: unknown; widget_settings: unknown }>
	| WebhookEnvelope<"aggregate.changed", { average: number; total: number; distribution: RatingDistribution }>;

/**
 * The directory endpoints, for partners that list PepReviewPro stores. `ApiStore` is the wire store and
 * `DirectoryStore` in `@pepreviewpro/server` is its camelCase DTO. On a key linked to a partner, `click_url` and
 * `profile_url` carry the partner's credit; `website_url` and `page_url` do not, so a partner links the first two.
 */

export type StoreSort = "best" | "reviews" | "rating" | "name";

export type ProductSort = "best" | "price" | "rating";

/** Filters `/stores` and `/products` share. A malformed value is a 400; an unknown `compound` matches nothing. */
export interface CatalogFilterQuery extends PageQuery {
	/** A compound's slug, name, or alias from the API's compound library. */
	compound?: string;
	/** A two-letter country code. A store that lists no countries never matches. */
	ships_to?: string;
	payment?: PaymentMethod;
	in_stock?: boolean;
	/** 0 to 5. Only stores whose `score` is at least this. */
	min_rating?: number;
}

export interface StoresQuery extends CatalogFilterQuery {
	/** Only stores whose name contains this. It never matches products or countries. */
	search?: string;
	sort?: StoreSort;
}

export interface ProductsQuery extends CatalogFilterQuery {
	compound: string;
	sort?: ProductSort;
	/** Store slugs, comma separated. Only their products, filtered before paging, so `total` counts only them. */
	store?: string;
}

/** The slim store each product carries. */
export interface ApiProductStore {
	slug: string;
	name: string;
	/** A `to` on the product's `click_url` must be on this host. */
	website_url: string | null;
}

/** A product that maps to the compound asked for. Prices are in the store's own currency, in major units. */
export interface ApiProduct {
	/** The store's own id for the product, like `"88"` or `"bpc-157-10mg"`. */
	ref: string;
	name: string;
	/** The product page, untracked. Link `click_url`. */
	page_url: string | null;
	/**
	 * Through `/go/`, crediting the key's partner. Goes to the store when the product is gone by the time it is
	 * clicked. Only on a key linked to a partner.
	 */
	click_url?: string;
	image_url: string | null;
	price_min: number | null;
	price_max: number | null;
	currency: string | null;
	in_stock: boolean;
	/** This product's published reviews. */
	review_count: number;
	store: ApiProductStore;
}

/** A store in the directory, from `/stores`. */
export interface ApiStore extends ApiStoreBase {
	/** The PepReviewPro score, which `min_rating` and `sort=rating` compare. */
	score: number;
	/** The store's PepReviewPro page, tagged with the key's partner. */
	profile_url: string;
	/** Through `/go/` to the store's site, crediting the key's partner. Only on a key linked to a partner. */
	click_url?: string;
	/** Only with `compound`: up to three of the store's matching products, in stock first, then cheapest. */
	matched_products?: ApiProduct[];
	/** Only with `compound`: how many of the store's products match it, where `matched_products` shows three at most. */
	matched_product_count?: number;
}

/** The filters `/stores` and `/products` applied, as the API read them. */
export interface CatalogFilterEcho {
	/** The compound as the library names it. Null when none was passed or the library does not know it. */
	compound: { slug: string; name: string } | null;
	/** `compound` was passed and is not in the library, so an empty list means unknown rather than unstocked. */
	unknown_compound: boolean;
	ships_to: string | null;
	payment: PaymentMethod | null;
	in_stock: boolean;
	min_rating: number | null;
}

export interface StoresResponse {
	stores: ApiStore[];
	/** Stores left after every filter, `min_rating` included. */
	total: number;
	next_cursor: string | null;
	filters: CatalogFilterEcho;
}

export interface ProductsResponse {
	products: ApiProduct[];
	total: number;
	next_cursor: string | null;
	filters: CatalogFilterEcho;
}

export interface DirectoryReviewsQuery extends PageQuery {
	/** One store's slug. Leave out for every store in the directory. */
	store?: string;
	/** 0 to 5. */
	min_rating?: number;
}

export interface DirectoryReviewsResponse {
	/** Newest first. */
	reviews: ApiReview[];
	next_cursor: string | null;
}

export interface VendorMissRequest {
	/** The store's name as the user wrote it. The API keeps the first 120 characters. */
	name: string;
	/** The store's address, when the user gave one. The API keeps 500 characters. */
	url?: string | null;
	/** The user's question, with nothing that identifies them. The API keeps 200 characters. */
	question?: string | null;
}

export interface VendorMissResponse {
	/** The store is on PepReviewPro. */
	in_directory: boolean;
	/** Partners may show it, so a search missed it. */
	listed_with_partners: boolean;
}

/** Values from the app's `lib/enums/outboundClick.ts` placements. */
export type Placement = "storeHeader" | "storeAbout" | "directoryCard" | "finderProduct" | "finderStore" | "offerCard" | "returnToStore";

export interface PartnerEvent {
	/**
	 * Your own id for the event, 1 to 100 characters. One already sent in the last 7 days counts as a duplicate.
	 * `partnerEvents` generates one when it is left out.
	 */
	id?: string;
	/** `shown` for a store shown to a user; `click` for a visit sent by a link other than `click_url`. */
	type: "shown" | "click";
	/** The store's `slug` from `/stores` or `/products`. */
	store: string;
	/** The product's `ref`, when a click went to a product. */
	product_ref?: string;
	compound?: string;
	placement?: Placement;
}

export interface PartnerEventsRequest {
	/** Up to 50. A malformed event or an unknown store is skipped, not refused. */
	events: PartnerEvent[];
}

export interface PartnerEventsResponse {
	/** Events that counted. */
	recorded: number;
	/** Events whose `id` was already sent in the last 7 days, or repeated within the call. Not counted again. */
	duplicates: number;
	/** Malformed events and events naming an unknown store. */
	skipped: number;
}

export interface MeResponse {
	key: { id: string; key_prefix: string; key_type: string; scopes: string[] };
	/** The month figures are the account's. A store key has no monthly quota, so its quota and remainder are null. */
	limits: { rate_per_second: number; monthly_quota: number | null; used_this_month: number; remaining_this_month: number | null };
}

/** Every failure from an endpoint that takes a key. Branch on `code`; `message` is for people. */
export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		/** The same as the response's `X-Request-Id` header. */
		request_id: string;
		/** On `invalid_body`: the problems by field. */
		details?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
	};
}
