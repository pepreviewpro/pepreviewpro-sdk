/** A product's price in its own currency, as a range when it has one, or null when it has none. */
export function formatPrice({
	priceMin,
	priceMax,
	currency
}: {
	priceMin: number | null;
	priceMax: number | null;
	currency: string | null;
}): string | null {
	if (priceMin === null) {
		return null;
	}

	const format = (amount: number) => {
		try {
			return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(amount);
		} catch {
			return `${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;
		}
	};

	return priceMax !== null && priceMax > priceMin ? `${format(priceMin)} to ${format(priceMax)}` : format(priceMin);
}
