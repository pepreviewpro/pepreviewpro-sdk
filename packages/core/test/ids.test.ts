import { describe, expect, it } from "vitest";
import { assertId, isNumericId } from "../src";

describe("isNumericId", () => {
	it.each([
		[1, true],
		[1002, true],
		["1002", true],
		[8_999_999_999_999, true],
		[9_000_000_000_000, false],
		["9000000000001", false],
		["99999999999999999999", false],
		[0, false],
		[-4, false],
		[1.5, false],
		["0123", false],
		["ORD-1001", false],
		["12abc", false],
		["", false]
	])("%j is numeric: %s", (id, numeric) => {
		expect(isNumericId(id)).toBe(numeric);
	});
});

describe("assertId", () => {
	it("accepts positive integers and strings up to 200 characters", () => {
		expect(() => assertId(1, "id")).not.toThrow();
		expect(() => assertId("gid://shopify/Order/1", "id")).not.toThrow();
		expect(() => assertId("x".repeat(200), "id")).not.toThrow();
	});

	it("names the field it refuses", () => {
		expect(() => assertId(null, "orders[3].id")).toThrow(/orders\[3\]\.id/);
		expect(() => assertId({}, "id")).toThrow(TypeError);
	});
});
