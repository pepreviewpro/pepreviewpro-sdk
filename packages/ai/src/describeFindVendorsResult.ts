import { formatPrice } from "./formatPrice";
import type { FindVendorsResult, VendorFilter } from "./types";

const FILTER_NAME: Record<VendorFilter["kind"], string> = { compound: "compound", shipsTo: "shipping", payment: "payment" };

/** What every shown store does, for a sentence whose subject is one store or several. */
function meets(filter: VendorFilter, one: boolean): string {
	const verb = (singular: string, plural: string) => (one ? singular : plural);
	switch (filter.kind) {
		case "compound": {
			return `${verb("lists", "list")} a ${filter.label} product`;
		}

		case "shipsTo": {
			return `${verb("ships", "ship")} to ${filter.label}`;
		}

		case "payment": {
			return `${verb("takes", "take")} ${filter.label}`;
		}
	}
}

/** The no-match half of a dropped filter: "lists Canada in its shipping countries". */
function misses(filter: VendorFilter): string {
	switch (filter.kind) {
		case "compound": {
			return `lists a ${filter.label} product`;
		}

		case "shipsTo": {
			return `lists ${filter.label} in its shipping countries`;
		}

		case "payment": {
			return `takes ${filter.label}`;
		}
	}
}

const list = (items: string[]) => (items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`);

export interface DescribeOptions {
	/** Your app draws a card for each store, so the model should not list them again. Default true. */
	cards?: boolean | undefined;
}

/**
 * The facts of a `find_vendors` result as sentences the answer must state, then each store's figures. The model is
 * told to repeat the facts in its own words and never soften them, so "no store ships to Canada" cannot turn into a
 * shortlist that leans toward Canada.
 */
export function describeFindVendorsResult(result: FindVendorsResult, options: DescribeOptions = {}): string {
	const cards = options.cards ?? true;
	const { stores, applied, dropped } = result;
	const count = stores.length;
	const one = count === 1;
	const noun = `${count} store${one ? "" : "s"}`;
	const facts: string[] = [];
	if (result.notInDirectory) {
		facts.push(`${result.notInDirectory} is not reviewed on PepReviewPro.`);
	}

	if (result.unknownCompound) {
		facts.push(`${result.unknownCompound} is not a compound the directory knows, so it could not be looked for.`);
	}

	if (count === 0) {
		facts.push(result.notInDirectory ? "No reviewed alternatives were looked up." : "Nothing in the directory matches.");
	} else if (result.storeName && !result.notInDirectory) {
		facts.push(`${noun} in the directory ${one ? "matches" : "match"} the name ${result.storeName}.`);
		const compound = dropped.find((filter) => filter.kind === "compound");
		if (compound) {
			facts.push(`${one ? "It does" : "None of them"} ${one ? "not list" : "lists"} a ${compound.label} product.`);
		} else if (applied.length > 0) {
			facts.push(`${one ? "It" : `All ${count}`} ${list(applied.map((filter) => meets(filter, one)))}.`);
		}
	} else if (dropped.length > 0) {
		const missed = dropped.length === 1 ? misses(dropped[0]!) : `meets all of: ${list(dropped.map((filter) => meets(filter, true)))}`;
		facts.push(
			`No store in the directory ${missed}, so these ${noun} are the top rated with no ${list(dropped.map((filter) => FILTER_NAME[filter.kind]))} filter.`
		);
		if (applied.length > 0) {
			facts.push(`${one ? "It" : `All ${count}`} ${list(applied.map((filter) => meets(filter, one)))}.`);
		}
	} else if (applied.length > 0) {
		facts.push(`${noun} ${list(applied.map((filter) => meets(filter, one)))}.`);
	} else {
		facts.push(`Showing ${noun}, the top rated in the directory.`);
	}

	if (result.shipsToFrom === "fallback") {
		facts.push("The country is a default for this user, not something they said.");
	}

	const data = stores.map((store) => {
		const figures = [
			`${store.name}: rated ${store.rating.toFixed(2)} out of 5 from ${store.reviewCount} reviews, ${store.verifiedReviewCount} verified`,
			...(store.discountCode ? [`discount code ${store.discountCode}`] : []),
			...(cards ? [] : [`link ${store.link}`])
		];
		if (!store.product) {
			return figures.join(", ");
		}

		const price = formatPrice(store.product);
		const more = store.moreProducts > 0 ? `, ${store.moreProducts} more matching product${store.moreProducts === 1 ? "" : "s"}` : "";
		const stock = store.product.inStock ? "in stock" : "out of stock";
		const productLink = cards ? "" : `, link ${store.product.link}`;
		return `${figures.join(", ")}, ${store.product.name}${price ? ` at ${price}` : ""}, ${stock}${more}${productLink}`;
	});
	const shown = cards
		? `${count} store card(s) are shown to the user with each store's details. Store data: ${data.join("; ")}.`
		: `Store data: ${data.join("; ")}.`;
	const rules = cards
		? "State the facts above in your own words and do not soften them. Do not list the stores again, since the cards show them; point out standouts instead."
		: "State the facts above in your own words and do not soften them. Link a store or product only with its link above, exactly as given.";
	return [`Facts: ${facts.join(" ")}`, ...(count > 0 ? [shown] : []), `${rules} Prices are each store's own, in its currency.`].join("\n");
}
