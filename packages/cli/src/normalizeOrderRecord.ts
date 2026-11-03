import type { Attribution, OrderStatus } from "@pepreviewpro/core";
import type { LineItem, Order } from "@pepreviewpro/server";

const STATUSES = new Set<OrderStatus>(["pending", "paid", "completed", "refunded", "cancelled"]);

type Raw = Record<string, unknown>;

/** The first of `names` that has a value, so a record may use the SDK's camelCase or the API's snake_case. */
function pick(record: Raw, ...names: string[]): unknown {
	for (const name of names) {
		const value = record[name];
		if (value !== undefined && value !== null && value !== "") {
			return value;
		}
	}

	return undefined;
}

function text(value: unknown): string | null {
	return value === undefined ? null : String(value).trim() || null;
}

function amount(value: unknown, field: string): number | null {
	if (value === undefined) {
		return null;
	}

	const number = typeof value === "number" ? value : Number(String(value).trim());
	if (!Number.isFinite(number)) {
		throw new Error(`${field} is not a number: "${String(value)}"`);
	}

	return number;
}

function id(value: unknown, field: string): string | number {
	if (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) {
		return typeof value === "string" ? value.trim() : value;
	}

	throw new Error(`${field} is missing`);
}

function lineItem(raw: unknown, index: number): LineItem {
	const record = (raw ?? {}) as Raw;
	const variation = pick(record, "variationId", "variation_id");
	return {
		productId: id(pick(record, "productId", "product_id"), `line_items[${index}].product_id`),
		variationId: variation === undefined ? null : id(variation, `line_items[${index}].variation_id`),
		name: text(pick(record, "name", "product_name")),
		quantity: amount(pick(record, "quantity"), `line_items[${index}].quantity`),
		total: amount(pick(record, "total", "line_total"), `line_items[${index}].total`)
	};
}

/** One order from a JSON or CSV record, in either naming. Throws with the field at fault. */
export function normalizeOrderRecord(record: Raw): Order {
	const status = text(pick(record, "status"))?.toLowerCase().replace(/^wc-/, "");
	if (!status || !STATUSES.has(status as OrderStatus)) {
		throw new Error(`status must be one of ${[...STATUSES].join(", ")}, got "${String(record["status"] ?? "")}"`);
	}

	const items = pick(record, "lineItems", "line_items");
	const reviewsSeen = pick(record, "reviewsSeenAt", "reviews_seen_at");
	return {
		id: id(pick(record, "id", "order_id"), "id"),
		status: status as OrderStatus,
		email: text(pick(record, "email")),
		name: text(pick(record, "name")),
		customerId: pick(record, "customerId", "customer_id") === undefined ? null : id(pick(record, "customerId", "customer_id"), "customer_id"),
		total: amount(pick(record, "total"), "total"),
		currency: text(pick(record, "currency")),
		lineItems: Array.isArray(items) ? items.map(lineItem) : [],
		createdAt: text(pick(record, "createdAt", "created_at")),
		paidAt: text(pick(record, "paidAt", "paid_at")),
		completedAt: text(pick(record, "completedAt", "completed_at")),
		attribution: (pick(record, "attribution") as Attribution | undefined) ?? null,
		customerIp: text(pick(record, "customerIp", "customer_ip")),
		customerUserAgent: text(pick(record, "customerUserAgent", "customer_user_agent")),
		reviewsSeenAt: amount(reviewsSeen, "reviews_seen_at")
	};
}
