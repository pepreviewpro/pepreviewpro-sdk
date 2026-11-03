import { parseCsv } from "./parseCsv";

const LINE_COLUMNS = new Set(["product_id", "product_name", "variation_id", "quantity", "line_total"]);

/**
 * CSV with one row per line item into order records: rows sharing an `id` (or `order_id`) become one order, its
 * line items in row order. Headers are matched in lower case. Order columns are read from the order's first row.
 */
export function csvToRecords(text: string): Record<string, unknown>[] {
	const [header, ...rows] = parseCsv(text);
	if (!header) {
		return [];
	}

	const columns = header.map((name) => name.trim().toLowerCase());
	const orders = new Map<string, Record<string, unknown> & { line_items: Record<string, string>[] }>();
	rows.forEach((cells, rowIndex) => {
		const row = Object.fromEntries(columns.map((column, index) => [column, (cells[index] ?? "").trim()]));
		const key = row["id"] || row["order_id"] || `row ${rowIndex + 2}`;
		let order = orders.get(key);
		if (!order) {
			const fields = Object.fromEntries(Object.entries(row).filter(([column, value]) => !LINE_COLUMNS.has(column) && value !== ""));
			order = { ...fields, line_items: [] };
			orders.set(key, order);
		}

		if (row["product_id"]) {
			order.line_items.push(Object.fromEntries(Object.entries(row).filter(([column, value]) => LINE_COLUMNS.has(column) && value !== "")));
		}
	});
	return [...orders.values()];
}
