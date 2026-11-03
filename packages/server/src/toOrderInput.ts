import type { OrderInput } from "@pepreviewpro/core";
import type { RequestContext } from "./readRequestContext";
import { toIsoString } from "./toIsoString";
import type { LineItem, Order } from "./types";

/** `fields` without its `undefined` entries. An explicit null stays: it clears the field. */
function definedOnly<T extends object>(fields: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
	return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

const toLineItem = (item: LineItem) => ({
	product_id: item.productId,
	...definedOnly({ variation_id: item.variationId, name: item.name, quantity: item.quantity, total: item.total })
});

const toDate = (value: Order["createdAt"], field: string) => (value === undefined ? undefined : toIsoString(value, field));

/**
 * An `Order` in the API's own names. Fields the order leaves out are left out of the body, not sent as null, so a
 * repeat that only changes the status never clears what the first send set. The request context fills only gaps.
 */
export function toOrderInput(order: Order, context: RequestContext): OrderInput {
	const reviewsSeenAt = order.reviewsSeenAt ?? context.reviewsSeenAt ?? undefined;
	return {
		id: order.id,
		status: order.status,
		...definedOnly({
			email: order.email,
			name: order.name,
			customer_id: order.customerId,
			total: order.total,
			currency: order.currency,
			line_items: order.lineItems?.map(toLineItem),
			created_at: toDate(order.createdAt, "createdAt"),
			paid_at: toDate(order.paidAt, "paidAt"),
			completed_at: toDate(order.completedAt, "completedAt"),
			attribution: order.attribution ?? context.attribution ?? undefined,
			customer_ip: order.customerIp ?? context.ip ?? undefined,
			customer_user_agent: order.customerUserAgent ?? context.userAgent ?? undefined,
			reviews_seen_at: reviewsSeenAt instanceof Date ? Math.floor(reviewsSeenAt.getTime() / 1000) : reviewsSeenAt
		})
	};
}
