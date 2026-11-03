import type { DirectoryProduct, DirectoryStore, PaymentMethod } from "@pepreviewpro/server";
import type { ModelMessage } from "ai";

/** What the model passes to the tool. The names are the model's, snake_case, as the input schema describes them. */
export interface FindVendorsInput {
	compound?: string | undefined;
	ships_to?: string | undefined;
	payment?: PaymentMethod | undefined;
	store_name?: string | undefined;
	limit?: number | undefined;
}

/** A filter the tool was asked for, with the words the answer and the cards use for it. */
export interface VendorFilter {
	kind: "compound" | "shipsTo" | "payment";
	/** A compound as the API takes it, a two-letter country code, or a payment method. */
	value: string;
	/** "BPC-157", "Canada", "Card". */
	label: string;
}

/** A store's product that maps to the compound asked for. Prices are the store's own, in its currency. */
export interface FindVendorsProduct {
	/** The store's own id for the product. */
	ref: string;
	name: string;
	imageUrl: string | null;
	priceMin: number | null;
	priceMax: number | null;
	currency: string | null;
	inStock: boolean;
	reviewCount: number;
	/**
	 * The link to render. It goes through PepReviewPro, which credits you, and carries `overlay.productUrl` when it
	 * can. On a key no partner is linked to there is no tracked link, so it is the overlay's or the product's own page.
	 */
	link: string;
	/** The overlay's product URL when `link` could not carry it. Linking it earns no credit unless you report a `click`. */
	untrackedUrl: string | null;
}

export interface FindVendorsStore {
	/** The store's slug, the id every PepReviewPro call takes. */
	slug: string;
	name: string;
	description: string | null;
	/** The average star rating, out of 5. Show this one. */
	rating: number;
	/** The PepReviewPro score the directory ranks by. It is not a star rating. */
	score: number;
	reviewCount: number;
	verifiedReviewCount: number;
	logoUrl: string | null;
	accentColor: string | null;
	/**
	 * The link to render. It goes through PepReviewPro, which credits you, and carries `overlay.url` when it can. On a
	 * key no partner is linked to there is no tracked link, so it is the overlay's URL or the store's own site.
	 */
	link: string;
	/** The store's PepReviewPro page, tagged with your partner name. */
	profileUrl: string;
	/** The asked country's name, only when the store lists it. Never a claim the directory did not make. */
	shipsTo: string | null;
	/** The best match for the compound asked for: in stock first, then the lowest price. */
	product: FindVendorsProduct | null;
	/** How many other products of the store match the compound, from the API's `matched_product_count`. */
	moreProducts: number;
	discountCode: string | null;
	/** The overlay's URL when `link` could not carry it. Linking it earns no credit unless you report a `click`. */
	untrackedUrl: string | null;
}

/** What `find_vendors` returns. Hosts draw cards from it; the model reads `describeFindVendorsResult`. */
export interface FindVendorsResult {
	/** The store name the user asked about, when they named one. */
	storeName: string | null;
	/** The store the user named, when the directory does not review it. */
	notInDirectory: string | null;
	/** The compound asked for, when it is not one the directory knows. */
	unknownCompound: string | null;
	/** Filters the stores shown meet. */
	applied: VendorFilter[];
	/** Filters that matched nothing and were let go to find these stores. */
	dropped: VendorFilter[];
	/** Where the country came from: the model's input, or `fallbackCountry`. Null when no country was asked. */
	shipsToFrom: "input" | "fallback" | null;
	stores: FindVendorsStore[];
	/** Nothing to draw: no stores and no not-in-directory line. */
	empty: boolean;
}

/** What the hooks get: the conversation as the AI SDK passes it to the tool. */
export interface FindVendorsContext {
	/** The text of the user's last message, or null when there is none. */
	question: string | null;
	messages: readonly ModelMessage[];
	toolCallId: string | null;
	/** The AI SDK's tool `context`, as your `generateText` or `streamText` call passed it. */
	context: unknown;
	abortSignal: AbortSignal | undefined;
}

/** A compound in your own vocabulary, mapped to what the API takes and how to name it. */
export interface ResolvedCompound {
	/** A slug, name, or alias the API knows, like `bpc-157`. */
	value: string;
	label: string;
}

/** Links of your own for a store, like an affiliate's, attached without losing the tracked click. */
export interface VendorOverlay {
	/** A page to land on. On the store's own site it rides inside the tracked link as `to`; elsewhere it is `untrackedUrl`. */
	url?: string | null | undefined;
	/** The same, for the product the tool shows. */
	productUrl?: string | null | undefined;
	discountCode?: string | null | undefined;
}

export interface FindVendorsOptions {
	/** Stores a call returns when the model leaves `limit` unset. Default 3. */
	defaultLimit?: number | undefined;
	/** The most stores the model may ask for. Default 6, at most 100. */
	maxLimit?: number | undefined;
	/**
	 * Maps the compound the model passed to one the API knows. Return null when your vocabulary has no such
	 * compound, and the result says so as `unknownCompound`. Default: the text as given.
	 */
	resolveCompound?:
		| ((
				text: string,
				context: FindVendorsContext
		  ) => ResolvedCompound | string | null | undefined | Promise<ResolvedCompound | string | null | undefined>)
		| undefined;
	/** A country to use when the user named none, like one from their profile. A two-letter code, or null for none. */
	fallbackCountry?: ((context: FindVendorsContext) => string | null | undefined | Promise<string | null | undefined>) | undefined;
	/** Links of your own for a store, given the product the tool picked for it. */
	overlayLinks?:
		| ((
				store: DirectoryStore,
				product: DirectoryProduct | null,
				context: FindVendorsContext
		  ) => VendorOverlay | null | undefined | Promise<VendorOverlay | null | undefined>)
		| undefined;
	/**
	 * Tells PepReviewPro about a store the user named that the directory does not have, in the background. On by
	 * default, with the user's last message as the question. `{ includeQuestion: false }` leaves the question out.
	 */
	reportMisses?: boolean | { includeQuestion?: boolean | undefined } | undefined;
	/**
	 * Reports the stores returned as `shown`, in the background. Off by default: until your first `shown` event, your
	 * reads count as your impressions. Turn it on if you send `shown` events anywhere, since from then on only they
	 * count, or when you show the result again from a cache of your own.
	 */
	reportShown?: boolean | undefined;
	/** The payment methods the model may filter by. Default all of them. */
	paymentMethods?: readonly PaymentMethod[] | undefined;
	/**
	 * Whether your app draws a card for each store from the tool's output. When it does, the model is told not to
	 * list the stores again. When it does not, the model gets each store's tracked link to write. Default true.
	 */
	cards?: boolean | undefined;
}
