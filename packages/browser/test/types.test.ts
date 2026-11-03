import type { Attribution as CoreAttribution } from "@pepreviewpro/core";
import { describe, expectTypeOf, it } from "vitest";
import type { Attribution } from "../src";

describe("Attribution", () => {
	it("is the same shape as core's wire type", () => {
		expectTypeOf<Attribution>().toEqualTypeOf<CoreAttribution>();
	});
});
