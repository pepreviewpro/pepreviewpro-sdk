/**
 * Stand-ins for the store's own code, which the docs' samples call but cannot show: its checkout, its database, its
 * cookie banner. Only `pnpm docs:snippets` loads this file, so every other name in a sample must come from a real
 * import. Keep each stand-in's types honest: they are what the samples check the SDK's types against.
 */
import type { CatalogProduct, ImportCheckpoint, Order, ReviewsSyncPage } from "@pepreviewpro/server";

declare global {
	/** An order as a store's own checkout might save it. */
	interface StoreOrder {
		number: string;
		email: string;
		name: string;
		total: number;
		currency: string;
		createdAt: string;
		items: { sku: string; title: string; quantity: number; total: number }[];
	}

	/** The store's checkout, saving the order from the cart or form it is given. */
	function saveOrder(input: unknown): Promise<StoreOrder>;

	/** The store's database: every order ever placed. */
	function allPastOrders(): AsyncIterable<Order>;

	/** The store's database: orders created or changed since `since`. */
	function ordersUpdatedSince(since: Date): AsyncIterable<Order>;

	/** The store's database: every product. */
	function allProducts(): Promise<CatalogProduct[]>;

	/** Wherever the store keeps an import's place between runs. */
	function loadCheckpoint(): Promise<ImportCheckpoint | null>;
	function saveCheckpoint(checkpoint: ImportCheckpoint): Promise<void>;

	/** The store's own copy of its reviews, for stores that mirror them. */
	function saveReview(review: ReviewsSyncPage["reviews"][number]): Promise<void>;
	function lastReviewSync(): Promise<Date | undefined>;
	function saveLastReviewSync(at: Date): Promise<void>;

	/** The store's own cache, for stacks without Next.js's. */
	function clearReviewCache(store: string): Promise<void>;

	/** The store's cookie banner. */
	const consentBanner: { allows(category: "analytics"): boolean };
}
