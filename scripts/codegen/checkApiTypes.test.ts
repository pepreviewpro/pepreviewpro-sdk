import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkApiTypes, RESPONSE_TYPES, type ExportedEndpoint } from "./checkApiTypes";

/** `skipped_reason` is in the docs' notes, not in its response example. */
const WARNINGS = ["/api/v1/orders: optional results[].skipped_reason is not in the example."];
const TYPES = fileURLToPath(new URL("../../packages/core/src/types.ts", import.meta.url));
/** The app's export as `pnpm sync-fixtures` last brought it in. */
const appNow = JSON.parse(readFileSync(new URL("../../test/fixtures/apiEndpoints.json", import.meta.url), "utf8")) as ExportedEndpoint[];

describe("checkApiTypes", () => {
	it("passes against the app's current export", () => {
		const report = checkApiTypes(appNow, TYPES);
		expect(report.errors).toEqual([]);
		expect(report.warnings).toEqual(WARNINGS);
	});

	it("fails when a documented field the SDK reads goes away", () => {
		const endpoints = structuredClone(appNow);
		const orders = endpoints.find((endpoint) => endpoint.path === "/api/v1/orders") as { response: { results: Record<string, unknown>[] } };
		for (const result of orders.response.results) {
			delete result["queued"];
		}

		expect(checkApiTypes(endpoints, TYPES).errors).toEqual(["/api/v1/orders: OrdersResponse.results[].queued is not in the documented response."]);
	});

	it("covers every endpoint the client calls", () => {
		const client = readFileSync(new URL("../../packages/core/src/PepReviewProClient.ts", import.meta.url), "utf8");
		const called = [...client.matchAll(/path: "(\/api\/v1\/[a-z-]+)"/g)].map((match) => match[1]);
		expect(new Set(called)).toEqual(new Set(Object.keys(RESPONSE_TYPES)));
	});
});
