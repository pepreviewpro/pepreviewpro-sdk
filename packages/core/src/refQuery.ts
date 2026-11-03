import { isNumericId } from "./isNumericId";
import type { ExternalId } from "./types";

/**
 * The id fields a read or the review form takes for one of the store's own ids: the frozen integer `product_id` or
 * `order_id` when the id passes through as a number, else `product_ref` or `order_ref`. Empty when there is no id.
 */
export function refQuery<Name extends "product" | "order">(
	name: Name,
	ref: ExternalId | null | undefined
): Partial<Record<`${Name}_id`, number> & Record<`${Name}_ref`, ExternalId>> {
	if (ref === undefined || ref === null || ref === "") {
		return {};
	}

	return (isNumericId(ref) ? { [`${name}_id`]: Number(ref) } : { [`${name}_ref`]: ref }) as Partial<
		Record<`${Name}_id`, number> & Record<`${Name}_ref`, ExternalId>
	>;
}
