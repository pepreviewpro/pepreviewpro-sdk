import { describe, expect, it } from "vitest";
import { fakeKey } from "../../../test/replay";
import { csvToRecords } from "../src/csvToRecords";
import { keyKind } from "../src/keyKind";
import { normalizeOrderRecord } from "../src/normalizeOrderRecord";
import { parseCsv } from "../src/parseCsv";
import { parseDotenv } from "../src/parseDotenv";
import { parseDuration } from "../src/parseDuration";
import { upsertEnvLines } from "../src/upsertEnvLines";

describe("parseCsv", () => {
	it("handles quotes, embedded commas and newlines, CRLF, a BOM, and blank lines", () => {
		const text = '﻿id,name,note\r\n1,"Buyer, Jane","said ""hi""\nthen left"\r\n\r\n2,Bo,\n';
		expect(parseCsv(text)).toEqual([
			["id", "name", "note"],
			["1", "Buyer, Jane", 'said "hi"\nthen left'],
			["2", "Bo", ""]
		]);
	});
});

describe("csvToRecords", () => {
	it("groups one row per line item into orders", () => {
		const csv = [
			"id,status,email,created_at,product_id,product_name,quantity,line_total",
			"ORD-1,completed,a@example.com,2026-11-01T10:00:00Z,bpc-157,BPC-157,2,99",
			"ORD-1,completed,a@example.com,2026-11-01T10:00:00Z,tb-500,TB-500,1,45",
			"ORD-2,paid,b@example.com,2026-11-02T10:00:00Z,,,,"
		].join("\n");
		expect(csvToRecords(csv)).toEqual([
			{
				id: "ORD-1",
				status: "completed",
				email: "a@example.com",
				created_at: "2026-11-01T10:00:00Z",
				line_items: [
					{ product_id: "bpc-157", product_name: "BPC-157", quantity: "2", line_total: "99" },
					{ product_id: "tb-500", product_name: "TB-500", quantity: "1", line_total: "45" }
				]
			},
			{ id: "ORD-2", status: "paid", email: "b@example.com", created_at: "2026-11-02T10:00:00Z", line_items: [] }
		]);
	});
});

describe("normalizeOrderRecord", () => {
	it("reads snake_case and camelCase alike", () => {
		const snake = normalizeOrderRecord({
			id: "ORD-1",
			status: "Completed",
			customer_id: 7,
			line_items: [{ product_id: "semax-30mg", product_name: "Semax 30mg", quantity: "2", line_total: "99.5" }]
		});
		const camel = normalizeOrderRecord({
			id: "ORD-1",
			status: "completed",
			customerId: 7,
			lineItems: [{ productId: "semax-30mg", name: "Semax 30mg", quantity: 2, total: 99.5 }]
		});
		expect(snake).toEqual(camel);
		expect(snake.lineItems).toEqual([{ productId: "semax-30mg", variationId: null, name: "Semax 30mg", quantity: 2, total: 99.5 }]);
	});

	it("takes WooCommerce's wc- statuses", () => {
		expect(normalizeOrderRecord({ id: 1, status: "wc-completed" }).status).toBe("completed");
	});

	it("names the field at fault", () => {
		expect(() => normalizeOrderRecord({ id: "ORD-1", status: "shipped" })).toThrow(/status must be one of/);
		expect(() => normalizeOrderRecord({ status: "paid" })).toThrow(/id is missing/);
		expect(() => normalizeOrderRecord({ id: 1, status: "paid", total: "12,50" })).toThrow(/total is not a number/);
	});
});

describe("parseDuration", () => {
	it.each([
		["30m", 1_800_000],
		["48h", 172_800_000],
		["7d", 604_800_000]
	])("reads %s", (value, ms) => {
		expect(parseDuration(value)).toBe(ms);
	});

	it.each(["48", "2w", "0h", "-1d", "h"])("refuses %s", (value) => {
		expect(() => parseDuration(value)).toThrow(/like 30m, 48h, or 7d/);
	});
});

describe("dotenv", () => {
	it("parses comments, export, quotes, and inline comments", () => {
		expect(parseDotenv("# c\nexport A=1\nB=\"two words\"\nC=three # note\nD='#not'\nbad line")).toEqual({
			A: "1",
			B: "two words",
			C: "three",
			D: "#not"
		});
	});

	it("replaces a line in place and appends a new one", () => {
		expect(upsertEnvLines("A=1\nPEPREVIEWPRO_STORE=old\n", { PEPREVIEWPRO_STORE: "magnolia-store", PEPREVIEWPRO_API_KEY: "k" })).toBe(
			"A=1\nPEPREVIEWPRO_STORE=magnolia-store\nPEPREVIEWPRO_API_KEY=k\n"
		);
		expect(upsertEnvLines("", { A: "1" })).toBe("A=1\n");
	});
});

describe("keyKind", () => {
	it("tells store keys from owner keys", () => {
		expect(keyKind(fakeKey("sk"))).toBe("store");
		expect(keyKind(fakeKey("pk"))).toBe("owner");
		expect(keyKind("prp_0123456789abcdef0123456789abcdef")).toBeNull();
		expect(keyKind(`${fakeKey("sk")}x`)).toBeNull();
	});
});
