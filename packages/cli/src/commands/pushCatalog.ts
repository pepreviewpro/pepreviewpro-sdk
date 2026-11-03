import type { CatalogInput, CatalogProduct, PaymentMethod } from "@pepreviewpro/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSdk } from "../createSdk";
import type { Io } from "../io";
import { loadEnv } from "../loadEnv";
import { requireSetup } from "../requireSetup";

type Raw = Record<string, unknown>;

const value = (record: Raw, camel: string, snake: string) => record[camel] ?? record[snake];

function toProduct(raw: unknown): CatalogProduct {
	const record = (raw ?? {}) as Raw;
	return {
		id: record["id"] as CatalogProduct["id"],
		name: String(record["name"] ?? ""),
		shortDescription: value(record, "shortDescription", "short_description") as string | null,
		url: (record["url"] as string | undefined) ?? null,
		imageUrl: value(record, "imageUrl", "image_url") as string | null,
		priceMin: value(record, "priceMin", "price_min") as number | null,
		priceMax: value(record, "priceMax", "price_max") as number | null,
		currency: (record["currency"] as string | undefined) ?? null,
		inStock: value(record, "inStock", "in_stock") as boolean | null
	};
}

/** A catalog file as `CatalogInput`: an object with `products`, in either naming, or a bare array of products. */
function toCatalog(parsed: unknown): CatalogInput {
	const record = (Array.isArray(parsed) ? { products: parsed } : (parsed ?? {})) as Raw;
	if (!Array.isArray(record["products"])) {
		throw new Error("The file needs a `products` array, or to be an array of products.");
	}

	const shipsTo = value(record, "shipsTo", "ships_to");
	const shipsFrom = value(record, "shipsFrom", "ships_from");
	const paymentMethods = value(record, "paymentMethods", "payment_methods");
	return {
		products: record["products"].map(toProduct),
		...(Array.isArray(shipsTo) ? { shipsTo: shipsTo as string[] } : {}),
		...(typeof shipsFrom === "string" ? { shipsFrom } : {}),
		...(Array.isArray(paymentMethods) ? { paymentMethods: paymentMethods as PaymentMethod[] } : {})
	};
}

/** Replaces the store's catalog on PepReviewPro with a JSON file's, and its shipping and payment methods when listed. */
export async function pushCatalog(io: Io, file: string | undefined, flags: { store?: string | undefined }): Promise<number> {
	if (!file) {
		io.err("Pass the catalog file: `pepreviewpro push-catalog catalog.json`.");
		return 1;
	}

	const env = await loadEnv(io);
	const { store, apiKey } = requireSetup(env, flags.store);
	const catalog = toCatalog(JSON.parse(await readFile(resolve(io.cwd, file), "utf8")));
	const missing = catalog.products.findIndex((product) => product.id === undefined || product.id === null || !product.name);
	if (missing !== -1) {
		io.err(`Product ${missing + 1} needs an id and a name. Nothing was sent.`);
		return 1;
	}

	const result = await createSdk(io, env, store, apiKey).catalog.push(catalog);
	io.out(`Sent ${result.products} products. ${result.mapped} matched a compound, ${result.skipped} were skipped.`);
	return 0;
}
