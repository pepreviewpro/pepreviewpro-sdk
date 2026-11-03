import type { PaymentMethod, Placement, ProductSort, StoreSort } from "@pepreviewpro/core";

/**
 * The directory in camelCase, for partners that list PepReviewPro stores. Each shape is the wire's `Api*` type from
 * `@pepreviewpro/core` without the prefix: `ApiStore` becomes `DirectoryStore`. Link `clickUrl` and `profileUrl`.
 * They send the visit through PepReviewPro, which is how the store sees it came from you.
 */

/** The slim store each product carries. */
export interface DirectoryProductStore {
	/** The store's slug, the id every other call takes. */
	slug: string;
	name: string;
	/**
	 * The store's own website. Untracked, so do not link it: link `clickUrl`. `links.click` checks a `to` against its
	 * host, as `/go/` does.
	 */
	websiteUrl: string | null;
}

/** A store in the directory. */
export interface DirectoryStore extends DirectoryProductStore {
	description: string | null;
	/** The average star rating. Show this one when you show one number. */
	rating: number;
	/** The PepReviewPro score, which `minRating` and `sort: "rating"` compare. It ranks; it is not a star rating. */
	score: number;
	reviewCount: number;
	verifiedReviewCount: number;
	/**
	 * Link this to send a buyer to the store. It credits you, and goes through PepReviewPro on the way. Null on a key
	 * no partner is linked to.
	 */
	clickUrl: string | null;
	/** Link this to send a buyer to the store's PepReviewPro page. Tagged with your partner name. */
	profileUrl: string;
	logoUrl: string | null;
	accentColor: string | null;
	shipsFrom: string | null;
	/** Two-letter country codes. Empty means the store has not listed them, which is unknown, not nowhere. */
	shipsTo: string[];
	paymentMethods: PaymentMethod[];
	/** The store's lab results page. */
	coaUrl: string | null;
	/** ISO 8601. Null before the store's first catalog sync. */
	catalogSyncedAt: string | null;
	/** Only when you passed `compound`: up to three of the store's matching products, in stock first, then cheapest. */
	matchedProducts?: DirectoryProduct[];
	/** Only when you passed `compound`: how many of the store's products match it, all of them. */
	matchedProductCount?: number;
}

/** A product that maps to the compound asked for. Prices are the store's own, in its currency, in major units. */
export interface DirectoryProduct {
	/** The store's own id for the product, like `"88"` or `"bpc-157-10mg"`. */
	ref: string;
	name: string;
	imageUrl: string | null;
	priceMin: number | null;
	priceMax: number | null;
	currency: string | null;
	inStock: boolean;
	/** This product's own published reviews. */
	reviewCount: number;
	/**
	 * Link this. It goes to the product page through PepReviewPro, or to the store if the product is gone by then.
	 * Null on a key no partner is linked to.
	 */
	clickUrl: string | null;
	/** Untracked. Do not link it: a visit through it earns you no credit. Link `clickUrl`. */
	pageUrl: string | null;
	store: DirectoryProductStore;
}

/** A published review. Times are ISO 8601 UTC with milliseconds. */
export interface DirectoryReview {
	id: string;
	/** The store's slug. */
	store: string;
	/** The store's own id for the product, or null. */
	productRef: string | null;
	rating: number;
	title: string | null;
	body: string;
	/** Already shortened, like "Sam R.". */
	author: string;
	/** Matched to an order. */
	verified: boolean;
	createdAt: string;
	updatedAt: string;
}

/** One page of a list. Pass `nextCursor` back as `cursor`, with the same other options, for the next. */
export interface PageOptions {
	/** 1 to 100. Default 20. */
	limit?: number | undefined;
	/** `nextCursor` from the previous page. */
	cursor?: string | null | undefined;
	signal?: AbortSignal | undefined;
}

/** Filters `stores.list` and `products.list` share. */
export interface DirectoryFilters extends PageOptions {
	/** A compound's slug, name, or alias, like `bpc-157`. One the API does not know matches nothing. */
	compound?: string | undefined;
	/** A two-letter country code. A store that lists no countries never matches. */
	shipsTo?: string | undefined;
	payment?: PaymentMethod | undefined;
	/** On `stores.list`, only with `compound`: stores with a matching product in stock. */
	inStock?: boolean | undefined;
	/** 0 to 5. Only stores whose `score` is at least this. */
	minRating?: number | undefined;
}

export interface DirectoryStoresOptions extends DirectoryFilters {
	/** Only stores whose name contains this. It never matches products or countries. */
	search?: string | undefined;
	/** `best` weighs the score by review volume; `rating` is the score alone. Default `best`. */
	sort?: StoreSort | undefined;
}

export interface DirectoryProductsOptions extends DirectoryFilters {
	compound: string;
	/** Default `best`: the store's rank, then price. */
	sort?: ProductSort | undefined;
	/** Only products from these stores, by slug. Applied by the API before paging, so `total` counts only theirs. */
	stores?: readonly string[] | undefined;
}

export interface DirectoryReviewsOptions extends PageOptions {
	/** One store's slug. Leave out for every store in the directory. */
	store?: string | undefined;
	/** 0 to 5. */
	minRating?: number | undefined;
}

export interface CursorPage {
	/** Null on the last page. */
	nextCursor: string | null;
}

/** The filters the API applied, as it read them: a compound as the library names it, a country in capitals. */
export interface AppliedFilters {
	/** Null when none was passed or the library does not know it. */
	compound: { slug: string; name: string } | null;
	/** You passed `compound` and the library does not know it, so the empty list says nothing about stock. */
	unknownCompound: boolean;
	shipsTo: string | null;
	payment: PaymentMethod | null;
	inStock: boolean;
	minRating: number | null;
}

interface CatalogPage extends CursorPage {
	/** Matches after every filter, as the API counts them. */
	total: number;
	filters: AppliedFilters;
	/** The API does not know the `compound` you passed. The same as `filters.unknownCompound`. */
	unknownCompound: boolean;
}

export interface DirectoryStoresPage extends CatalogPage {
	stores: DirectoryStore[];
}

export interface DirectoryProductsPage extends CatalogPage {
	products: DirectoryProduct[];
}

export interface DirectoryReviewsPage extends CursorPage {
	reviews: DirectoryReview[];
}

export interface VendorMissInput {
	/** The store's name as your user wrote it. Trimmed and cut to 120 characters, as the API would. */
	name: string;
	/** The store's address, when your user gave one. Cut to 500 characters. */
	url?: string | null | undefined;
	/** Your user's question, with nothing that identifies them. Cut to 200 characters. */
	question?: string | null | undefined;
}

export interface VendorMissOutcome {
	/** The store is on PepReviewPro. */
	inDirectory: boolean;
	/** Partners may show it, so your search missed it. */
	listedWithPartners: boolean;
}

export interface DirectoryEvent {
	/**
	 * Your own id for the event, 1 to 100 characters, like the id of the chat message that showed it. One sent in the
	 * last 7 days counts as a duplicate, so a report repeated after a crash is never counted twice. Generated when left
	 * out, which guards only the retries of one report.
	 */
	id?: string | undefined;
	/** `shown` for a store you showed. `click` for a visit you sent by a link other than `clickUrl`. */
	type: "shown" | "click";
	/** The store's slug. */
	store: string;
	/** The product's `ref`, when a click went to a product. */
	productRef?: string | undefined;
	/** The compound your user asked about. */
	compound?: string | undefined;
	/** Where the link was, like `finderStore` or `finderProduct`. */
	placement?: Placement | undefined;
}

export interface BackgroundOptions {
	/** Send without waiting, through `waitUntil` when the client has one. Never throws. */
	background: true;
	/** Told about a failure that `background` would otherwise drop. */
	onError?: ((error: unknown) => void) | undefined;
}

export interface ForegroundOptions {
	background?: false | undefined;
	signal?: AbortSignal | undefined;
}

export interface EventsOutcome {
	/** Events that counted. */
	recorded: number;
	/** Events whose `id` was already sent in the last 7 days, or repeated within the report. Not counted again. */
	duplicates: number;
	/** Malformed events and events naming a store the directory does not have. */
	skipped: number;
}

export interface ApiKeyInfo {
	key: { id: string; prefix: string; type: string; scopes: string[] };
	/** The month figures are the account's. A store key has no monthly quota, so its quota and remainder are null. */
	limits: { ratePerSecond: number; monthlyQuota: number | null; usedThisMonth: number; remainingThisMonth: number | null };
}

export interface ClickLinkOptions {
	/**
	 * A page on the store's own site to land on instead, like an affiliate link. Added only when it is on the store's
	 * host or a subdomain of it, since `/go/` ignores any other.
	 */
	to?: string | null | undefined;
}
