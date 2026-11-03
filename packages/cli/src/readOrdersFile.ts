import type { Order } from "@pepreviewpro/server";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { csvToRecords } from "./csvToRecords";
import type { Io } from "./io";
import { normalizeOrderRecord } from "./normalizeOrderRecord";

const MAX_REPORTED = 10;

function jsonRecords(text: string): unknown[] {
	const trimmed = text.trim();
	if (trimmed === "") {
		return [];
	}

	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (Array.isArray(parsed)) {
			return parsed;
		}

		if (parsed && typeof parsed === "object" && Array.isArray((parsed as { orders?: unknown }).orders)) {
			return (parsed as { orders: unknown[] }).orders;
		}

		return [parsed];
	} catch {
		return trimmed
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "")
			.map((line, index) => {
				try {
					return JSON.parse(line) as unknown;
				} catch {
					throw new Error(`Line ${index + 1} is not JSON. Use a JSON array, one JSON order per line, or CSV.`);
				}
			});
	}
}

/**
 * Orders from a `.csv`, `.json`, or `.ndjson` file, or from stdin when `file` is `-` (JSON, or CSV with `--csv`).
 * Every record is checked before anything is sent, so a bad row stops the run instead of half an import.
 */
export async function readOrdersFile(file: string, io: Io, options: { csv?: boolean | undefined } = {}): Promise<Order[]> {
	const fromStdin = file === "-";
	const text = fromStdin ? await io.readStdin() : await readFile(resolve(io.cwd, file), "utf8");
	const isCsv = options.csv || (!fromStdin && extname(file).toLowerCase() === ".csv");
	const records = isCsv ? csvToRecords(text) : jsonRecords(text);
	const orders: Order[] = [];
	const problems: string[] = [];
	records.forEach((record, index) => {
		try {
			orders.push(normalizeOrderRecord((record ?? {}) as Record<string, unknown>));
		} catch (error) {
			problems.push(`Order ${index + 1}: ${(error as Error).message}`);
		}
	});
	if (problems.length > 0) {
		const more = problems.length > MAX_REPORTED ? `\n...and ${problems.length - MAX_REPORTED} more.` : "";
		throw new Error(`${problems.length} orders could not be read. Nothing was sent.\n${problems.slice(0, MAX_REPORTED).join("\n")}${more}`);
	}

	return orders;
}
