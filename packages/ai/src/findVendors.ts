import { PepReviewProApiError, type DirectoryProduct, type DirectoryStore, type PaymentMethod, type PepReviewProPartner } from "@pepreviewpro/server";
import { PAYMENT_LABELS } from "./paymentLabels";
import { readCountry } from "./readCountry";
import type {
	FindVendorsContext,
	FindVendorsInput,
	FindVendorsOptions,
	FindVendorsProduct,
	FindVendorsResult,
	FindVendorsStore,
	ResolvedCompound,
	VendorFilter
} from "./types";

export const DEFAULT_VENDOR_LIMIT = 3;
export const MAX_VENDOR_LIMIT = 6;
const STORE_NAME_LENGTH = 120;

const EMPTY_CONTEXT: FindVendorsContext = { question: null, messages: [], toolCallId: null, context: undefined, abortSignal: undefined };

interface Search {
	filters: VendorFilter[];
	stores: DirectoryStore[];
	/** The API's `unknown_compound`: the library does not know the compound, so no step with it can find a store. */
	unknownCompound: boolean;
}

function toCompound(resolved: ResolvedCompound | string | null | undefined): ResolvedCompound | null {
	if (!resolved) {
		return null;
	}

	return typeof resolved === "string" ? { value: resolved, label: resolved } : resolved;
}

const hasKind = (filters: VendorFilter[], kind: VendorFilter["kind"]) => filters.some((filter) => filter.kind === kind);

/** Stores with a matching product in stock first, keeping the API's rank otherwise. */
function inStockFirst(stores: DirectoryStore[]): DirectoryStore[] {
	const inStock = (store: DirectoryStore) => Number(store.matchedProducts?.some((product) => product.inStock) ?? false);
	return stores.toSorted((a, b) => inStock(b) - inStock(a));
}

/** The relaxed filter sets to try in order: all of them, the compound alone, the rest alone, then none. */
function ladder(asked: VendorFilter[]): VendorFilter[][] {
	const compound = asked.filter((filter) => filter.kind === "compound");
	const others = asked.filter((filter) => filter.kind !== "compound");
	const steps = [asked, compound, others, []];
	return steps.filter(
		(filters, index) => steps.findIndex((other) => other.length === filters.length && other.every((f) => filters.includes(f))) === index
	);
}

/**
 * Answers a sourcing question from the PepReviewPro directory in up to four reads. A filter that leaves nothing is
 * let go and reported in `dropped`, country and payment before the compound, so one call ends in stores or in a
 * plain "nothing matches". A store the user named that the directory lacks is reported as a vendor miss.
 */
export async function findVendors(
	partner: PepReviewProPartner,
	input: FindVendorsInput,
	options: FindVendorsOptions = {},
	context: FindVendorsContext = EMPTY_CONTEXT
): Promise<FindVendorsResult> {
	const maxLimit = Math.min(Math.max(1, options.maxLimit ?? MAX_VENDOR_LIMIT), 100);
	const limit = Math.min(Math.max(1, Math.trunc(input.limit ?? options.defaultLimit ?? DEFAULT_VENDOR_LIMIT)), maxLimit);
	const signal = context.abortSignal;
	const compoundText = input.compound?.trim() || null;
	const compound = compoundText
		? options.resolveCompound
			? toCompound(await options.resolveCompound(compoundText, context))
			: { value: compoundText, label: compoundText }
		: null;
	const stated = readCountry(input.ships_to);
	const fallback = stated ? null : readCountry(await options.fallbackCountry?.(context));
	let country = stated ?? fallback;
	const allowed = options.paymentMethods ?? (Object.keys(PAYMENT_LABELS) as PaymentMethod[]);
	const payment = input.payment && allowed.includes(input.payment) ? input.payment : null;
	let unknownCompound = compoundText && !compound ? compoundText : null;
	const asked = (): VendorFilter[] => [
		...(compound && !unknownCompound ? [{ kind: "compound" as const, value: compound.value, label: compound.label }] : []),
		...(country ? [{ kind: "shipsTo" as const, value: country.code, label: country.name }] : []),
		...(payment ? [{ kind: "payment" as const, value: payment, label: PAYMENT_LABELS[payment] }] : [])
	];
	const search = async (filters: VendorFilter[], name?: string): Promise<Search> => {
		const kept = filters.filter((filter) => filter.kind !== "shipsTo" || country);
		const value = (kind: VendorFilter["kind"]) => kept.find((filter) => filter.kind === kind)?.value;
		const withCompound = value("compound");
		try {
			const page = await partner.stores.list({
				...(name ? { search: name } : {}),
				...(withCompound ? { compound: withCompound } : {}),
				...(value("shipsTo") ? { shipsTo: value("shipsTo") } : {}),
				...(value("payment") ? { payment: value("payment") as PaymentMethod } : {}),
				sort: "best",
				limit,
				signal
			});
			return { filters: kept, stores: withCompound ? inStockFirst(page.stores) : page.stores, unknownCompound: page.unknownCompound === true };
		} catch (error) {
			// A code the API reads as no country, like EU, should cost the filter, not the answer.
			if (error instanceof PepReviewProApiError && error.code === "invalid_ships_to" && country) {
				country = null;
				return search(kept, name);
			}

			throw error;
		}
	};

	const relax = async (): Promise<Pick<FindVendorsResult, "applied" | "dropped" | "stores">> => {
		for (const filters of ladder(asked())) {
			const found = await search(filters);
			// The first read with the compound settles it: once the API says it is unknown, the ladder goes on without it.
			if (found.unknownCompound && compound && !unknownCompound) {
				unknownCompound = compoundText;
				return relax();
			}

			if (found.stores.length > 0) {
				const applied = asked().filter((filter) => hasKind(found.filters, filter.kind));
				return {
					applied,
					dropped: asked().filter((filter) => !hasKind(applied, filter.kind)),
					stores: await present(found.stores, applied)
				};
			}
		}

		return { applied: [], dropped: asked(), stores: [] };
	};

	const present = (stores: DirectoryStore[], applied: VendorFilter[]) => {
		const shipsTo = applied.find((filter) => filter.kind === "shipsTo") ?? null;
		return Promise.all(stores.map((store) => toResultStore(partner, store, shipsTo, options, context)));
	};

	const storeName = input.store_name?.trim().slice(0, STORE_NAME_LENGTH) || null;
	let result: Omit<FindVendorsResult, "empty" | "shipsToFrom" | "unknownCompound">;
	if (storeName) {
		const compoundOnly = asked().filter((filter) => filter.kind === "compound");
		const carrying = compoundOnly.length > 0 ? await search(compoundOnly, storeName) : null;
		const named = carrying?.stores.length ? carrying : await search([], storeName);
		if (named.stores.length > 0) {
			const applied = carrying?.stores.length ? carrying.filters : [];
			result = {
				storeName,
				notInDirectory: null,
				applied,
				dropped: asked().filter((filter) => filter.kind === "compound" && !hasKind(applied, "compound")),
				stores: await present(named.stores, applied)
			};
		} else {
			reportMiss(partner, storeName, options, context);
			const alternatives = compound || stated ? await relax() : { applied: [], dropped: [], stores: [] };
			result = { storeName, notInDirectory: storeName, ...alternatives };
		}
	} else {
		result = { storeName: null, notInDirectory: null, ...(await relax()) };
	}

	if (options.reportShown && result.stores.length > 0) {
		const shownCompound = result.applied.find((filter) => filter.kind === "compound")?.value;
		partner.events.report(
			result.stores.map((store) => ({ type: "shown" as const, store: store.slug, placement: "finderStore" as const, compound: shownCompound })),
			{ background: true }
		);
	}

	const countryAsked = [...result.applied, ...result.dropped].some((filter) => filter.kind === "shipsTo");
	return {
		...result,
		unknownCompound,
		shipsToFrom: countryAsked ? (stated ? "input" : "fallback") : null,
		empty: result.stores.length === 0 && !result.notInDirectory
	};
}

async function toResultStore(
	partner: PepReviewProPartner,
	store: DirectoryStore,
	shipsTo: VendorFilter | null,
	options: FindVendorsOptions,
	context: FindVendorsContext
): Promise<FindVendorsStore> {
	const matches = store.matchedProducts ?? [];
	const best: DirectoryProduct | null = matches.find((product) => product.inStock) ?? matches[0] ?? null;
	const overlay = (await options.overlayLinks?.(store, best, context)) ?? null;
	const tracked = partner.links.click(store, { to: overlay?.url });
	const link = tracked ?? overlay?.url ?? store.websiteUrl ?? store.profileUrl;
	const productTracked = best && partner.links.click(best, { to: overlay?.productUrl });
	const product: FindVendorsProduct | null = best && {
		ref: best.ref,
		name: best.name,
		imageUrl: best.imageUrl,
		priceMin: best.priceMin,
		priceMax: best.priceMax,
		currency: best.currency,
		inStock: best.inStock,
		reviewCount: best.reviewCount,
		link: productTracked ?? overlay?.productUrl ?? best.pageUrl ?? link,
		untrackedUrl: overlay?.productUrl && productTracked && productTracked === best.clickUrl ? overlay.productUrl : null
	};
	return {
		slug: store.slug,
		name: store.name,
		description: store.description,
		score: store.score,
		rating: store.rating,
		reviewCount: store.reviewCount,
		verifiedReviewCount: store.verifiedReviewCount,
		logoUrl: store.logoUrl,
		accentColor: store.accentColor,
		link,
		profileUrl: store.profileUrl,
		shipsTo: shipsTo && store.shipsTo.includes(shipsTo.value) ? shipsTo.label : null,
		product,
		moreProducts: Math.max((store.matchedProductCount ?? matches.length) - 1, 0),
		discountCode: overlay?.discountCode ?? null,
		untrackedUrl: overlay?.url && tracked && tracked === store.clickUrl ? overlay.url : null
	};
}

/** In the background: a failed report never changes the answer. */
function reportMiss(partner: PepReviewProPartner, name: string, options: FindVendorsOptions, context: FindVendorsContext): void {
	if (options.reportMisses === false) {
		return;
	}

	const includeQuestion = typeof options.reportMisses === "object" ? options.reportMisses.includeQuestion !== false : true;
	const question = includeQuestion ? context.question : null;
	const url = question?.match(/https?:\/\/\S+/)?.[0] ?? null;
	partner.vendorMiss.report({ name, url, question }, { background: true });
}
