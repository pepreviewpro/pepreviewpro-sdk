import type { ApiStore } from "@pepreviewpro/core";
import type { DirectoryStore } from "./directoryTypes";
import { toDirectoryProduct } from "./toDirectoryProduct";

/** A `/stores` store in the SDK's names. `matchedProducts` and `matchedProductCount` appear only when the API sent them. */
export function toDirectoryStore(store: ApiStore): DirectoryStore {
	return {
		slug: store.slug,
		name: store.name,
		websiteUrl: store.website_url,
		description: store.description,
		rating: store.rating,
		score: store.score,
		reviewCount: store.review_count,
		verifiedReviewCount: store.verified_review_count,
		clickUrl: store.click_url ?? null,
		profileUrl: store.profile_url,
		logoUrl: store.logo_url,
		accentColor: store.accent_color,
		shipsFrom: store.ships_from,
		shipsTo: store.ships_to,
		paymentMethods: store.payment_methods,
		coaUrl: store.coa_url,
		catalogSyncedAt: store.catalog_synced_at,
		...(store.matched_products ? { matchedProducts: store.matched_products.map(toDirectoryProduct) } : {}),
		...(typeof store.matched_product_count === "number" ? { matchedProductCount: store.matched_product_count } : {})
	};
}
