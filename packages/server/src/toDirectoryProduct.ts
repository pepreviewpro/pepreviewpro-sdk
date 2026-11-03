import type { ApiProduct } from "@pepreviewpro/core";
import type { DirectoryProduct } from "./directoryTypes";

/** A product in the SDK's names. The raw product page is `pageUrl`, so `clickUrl` is the obvious one to link. */
export function toDirectoryProduct(product: ApiProduct): DirectoryProduct {
	return {
		ref: product.ref,
		name: product.name,
		imageUrl: product.image_url,
		priceMin: product.price_min,
		priceMax: product.price_max,
		currency: product.currency,
		inStock: product.in_stock,
		reviewCount: product.review_count,
		clickUrl: product.click_url ?? null,
		pageUrl: product.page_url,
		store: { slug: product.store.slug, name: product.store.name, websiteUrl: product.store.website_url }
	};
}
