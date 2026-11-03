import type { CatalogFilterEcho } from "@pepreviewpro/core";
import type { AppliedFilters } from "./directoryTypes";

/** The `filters` echo of `/stores` and `/products` in the SDK's names. */
export function toAppliedFilters(echo: CatalogFilterEcho): AppliedFilters {
	return {
		compound: echo.compound,
		unknownCompound: echo.unknown_compound,
		shipsTo: echo.ships_to,
		payment: echo.payment,
		inStock: echo.in_stock,
		minRating: echo.min_rating
	};
}
