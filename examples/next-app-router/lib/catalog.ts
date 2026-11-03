/** Stands in for the store's own catalog. */
export const PRODUCTS = {
	"sku-101": { name: "BPC-157 10mg", price: 49.5, image: "https://store.example/img/sku-101.jpg" }
} as const;

export type ProductSlug = keyof typeof PRODUCTS;

export const STORE_URL = "https://store.example";
