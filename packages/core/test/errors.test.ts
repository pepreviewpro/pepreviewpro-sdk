import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESPONSE_TYPES } from "../../../scripts/codegen/checkApiTypes";
import { fakeKey, fixtureCase, jsonResponse, replayFetch } from "../../../test/replay";
import { API_ERROR_CODES, API_ERRORS, PepReviewProApiError, PepReviewProClient } from "../src";

const noRetry = { maxRetries: 0, apiKey: fakeKey() };
const order = { id: "ORD-1", status: "paid" as const };

async function failure(promise: Promise<unknown>): Promise<PepReviewProApiError> {
	const error = await promise.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(PepReviewProApiError);
	return error as PepReviewProApiError;
}

describe("error mapping", () => {
	it.each([
		["me", "no key", 401, "missing_api_key", API_ERRORS.missingKey],
		["me", "an unknown key", 401, "invalid_api_key", API_ERRORS.invalidKey],
		["me", "a revoked key", 401, "revoked_api_key", API_ERRORS.keyRevoked],
		["me", "an expired key", 401, "expired_api_key", API_ERRORS.keyExpired],
		["orders", "a store the key is not pinned to", 404, "store_not_found", API_ERRORS.storeNotFoundForKey],
		["orders", "a store uuid", 400, "uuid_not_accepted", API_ERRORS.uuidNotAccepted]
	])("reads %s %s's code, message, and request id", async (endpoint, name, status, code, message) => {
		const { fetch } = replayFetch(fixtureCase(endpoint, name));
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).orders({ store: "example-store", orders: [order] }));
		expect(caught).toMatchObject({ status, code, message, requestId: "contract-request-id", method: "POST", path: "/api/v1/orders" });
		expect(caught.isAuthError).toBe(status === 401);
	});

	it("reads `message` from the public endpoints, which send no code", async () => {
		const { fetch } = replayFetch(fixtureCase("get-widget-data", "an unknown store"));
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).widgetData({ site_id: "nope" }));
		expect(caught).toMatchObject({ status: 404, message: API_ERRORS.storeNotFound, code: undefined });
	});

	it("carries `details` on invalid_body and `reason` on a 429", async () => {
		const invalid = fixtureCase("orders", "field errors");
		const { fetch } = replayFetch(invalid);
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).orders({ store: "example-store", orders: [order] }));
		expect(caught).toMatchObject({ code: "invalid_body", message: API_ERRORS.invalidBody });
		expect(caught.details).toEqual((invalid.response.body as { error: { details: unknown } }).error.details);
		const limited = replayFetch(fixtureCase("my-stores", "over the rate limit"));
		const rate = await failure(new PepReviewProClient({ ...noRetry, fetch: limited.fetch }).orders({ store: "example-store", orders: [order] }));
		expect(rate).toMatchObject({ code: "rate_limited", reason: "rate_limit", isRateLimited: true });
		const monthly = replayFetch(fixtureCase("my-stores", "over the monthly quota"));
		expect(await failure(new PepReviewProClient({ ...noRetry, fetch: monthly.fetch }).me())).toMatchObject({
			code: "monthly_quota_exceeded",
			reason: "monthly_quota"
		});
	});

	it("flags a missing scope as an auth error", async () => {
		const { fetch } = replayFetch(fixtureCase("catalog", "a key without store:catalog"));
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).catalog({ store: "example-store", products: [] }));
		expect(caught).toMatchObject({ code: "insufficient_scope", message: `${API_ERRORS.insufficientScope}store:catalog scope.` });
		expect(caught.isAuthError).toBe(true);
	});

	it("takes the request id from the header and falls back to the status for a body that is not JSON", async () => {
		const { fetch } = replayFetch(new Response("<html>Bad gateway</html>", { status: 502, headers: { "x-request-id": "req_123" } }));
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).widgetData({ site_id: "example-store" }));
		expect(caught).toMatchObject({ status: 502, message: "<html>Bad gateway</html>", requestId: "req_123" });
		const empty = replayFetch(new Response(null, { status: 503 }));
		expect(await failure(new PepReviewProClient({ ...noRetry, fetch: empty.fetch }).widgetData({ site_id: "x" }))).toMatchObject({
			message: "HTTP 503"
		});
	});

	it("names the missing key before sending anything", async () => {
		const { fetch, requests } = replayFetch(jsonResponse(200, {}));
		await expect(new PepReviewProClient({ fetch }).heartbeat({} as never)).rejects.toThrow(/needs an API key/);
		expect(requests).toHaveLength(0);
	});
});

describe("API_ERRORS", () => {
	const endpoints = JSON.parse(readFileSync(new URL("../../../test/fixtures/apiEndpoints.json", import.meta.url), "utf8")) as {
		path: string;
		deprecated?: boolean;
		errors: { error: string; code?: string }[];
	}[];
	const called = endpoints.filter((endpoint) => endpoint.path in RESPONSE_TYPES);

	it("holds every message the endpoints the client calls document, word for word", () => {
		const known = Object.values(API_ERRORS);
		const missing = called
			.flatMap((endpoint) => endpoint.errors.map((row) => row.error))
			.filter((error) => !known.some((message) => error === message || (message.endsWith(" ") && error.startsWith(message))));
		expect(missing).toEqual([]);
	});

	it("reads the code beside the message", async () => {
		const { fetch } = replayFetch(fixtureCase("products", "an unknown sort"));
		const caught = await failure(new PepReviewProClient({ ...noRetry, fetch }).products({ compound: "bpc-157", sort: "best" }));
		expect(caught).toMatchObject({ message: API_ERRORS.invalidProductSort, code: "invalid_sort" });
	});
});

describe("API_ERROR_CODES", () => {
	it("lists exactly the codes the endpoints the client calls document", () => {
		const endpoints = JSON.parse(readFileSync(new URL("../../../test/fixtures/apiEndpoints.json", import.meta.url), "utf8")) as {
			path: string;
			errors: { code?: string }[];
		}[];
		const documented = endpoints
			.filter((endpoint) => endpoint.path in RESPONSE_TYPES)
			.flatMap((endpoint) => endpoint.errors.flatMap((row) => row.code ?? []));
		expect(new Set(API_ERROR_CODES)).toEqual(new Set(documented));
	});
});
