import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch } from "../../../test/replay";
import {
	API_ERRORS,
	backoffDelay,
	parseRetryAfter,
	PepReviewProApiError,
	PepReviewProClient,
	PepReviewProNetworkError,
	type ClientOptions
} from "../src";

const rateLimited = fixtureCase("my-stores", "over the rate limit");
const monthlyQuota = fixtureCase("my-stores", "over the monthly quota");
const heartbeatOk = fixtureCase("heartbeat", "records the install, dropping capabilities it does not know");
const heartbeatBody = heartbeatOk.request.body as Parameters<PepReviewProClient["heartbeat"]>[0];
const internalError = { error: { code: "internal_error", message: API_ERRORS.internal, request_id: "req_1" } };

function client(fetchImpl: typeof fetch, options: ClientOptions = {}) {
	const sleeps: number[] = [];
	const instance = new PepReviewProClient({
		apiKey: fakeKey(),
		fetch: fetchImpl,
		random: () => 0.5,
		sleep: async (ms) => {
			sleeps.push(ms);
		},
		...options
	});
	return { instance, sleeps };
}

describe("parseRetryAfter", () => {
	it("reads delta seconds, fractions, and HTTP dates", () => {
		const now = Date.parse("2026-11-02T16:00:00Z");
		expect(parseRetryAfter("1")).toBe(1000);
		expect(parseRetryAfter(" 2.5 ")).toBe(2500);
		expect(parseRetryAfter("Mon, 02 Nov 2026 16:00:30 GMT", now)).toBe(30_000);
		expect(parseRetryAfter("Mon, 02 Nov 2026 15:00:00 GMT", now)).toBe(0);
	});

	it("is null when absent or unreadable", () => {
		expect(parseRetryAfter(null)).toBeNull();
		expect(parseRetryAfter("")).toBeNull();
		expect(parseRetryAfter("soon")).toBeNull();
		expect(parseRetryAfter("-1")).toBeNull();
	});
});

describe("backoffDelay", () => {
	const options = { baseDelayMs: 500, maxDelayMs: 20_000, random: () => 0.999 };

	it("doubles the ceiling each attempt and caps it", () => {
		expect([0, 1, 2, 3, 10].map((attempt) => backoffDelay(attempt, null, options))).toEqual([499, 999, 1998, 3996, 19_980]);
	});

	it("spreads retries with full jitter", () => {
		expect(backoffDelay(3, null, { ...options, random: () => 0 })).toBe(0);
		expect(backoffDelay(3, null, { ...options, random: () => 0.5 })).toBe(2000);
	});

	it("never waits less than Retry-After", () => {
		expect(backoffDelay(0, 5000, options)).toBe(5000);
		expect(backoffDelay(5, 1000, options)).toBe(15_984);
	});
});

describe("retries", () => {
	it("retries a 429 after the recorded Retry-After, then succeeds", async () => {
		const { fetch, requests } = replayFetch(rateLimited, heartbeatOk);
		const { instance, sleeps } = client(fetch);
		await expect(instance.heartbeat(heartbeatBody)).resolves.toEqual(heartbeatOk.response.body);
		expect(requests).toHaveLength(2);
		expect(sleeps).toEqual([1000]);
	});

	it("does not retry the monthly quota, which only clears next month", async () => {
		const { fetch, requests } = replayFetch(monthlyQuota);
		const error = await client(fetch)
			.instance.heartbeat(heartbeatBody)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(PepReviewProApiError);
		expect(error).toMatchObject({ status: 429, message: API_ERRORS.monthlyQuota, reason: "monthly_quota", isRateLimited: true });
		expect(requests).toHaveLength(1);
	});

	it("retries 5xx with growing backoff and gives up after maxRetries", async () => {
		const { fetch, requests } = replayFetch(jsonResponse(503, internalError));
		const { instance, sleeps } = client(fetch, { maxRetries: 3 });
		await expect(instance.heartbeat(heartbeatBody)).rejects.toMatchObject({ status: 503, code: "internal_error", message: API_ERRORS.internal });
		expect(requests).toHaveLength(4);
		expect(sleeps).toEqual([250, 500, 1000]);
	});

	it("retries a dropped connection on a safe request", async () => {
		const { fetch, requests } = replayFetch(new TypeError("fetch failed"), heartbeatOk);
		await expect(client(fetch).instance.heartbeat(heartbeatBody)).resolves.toEqual(heartbeatOk.response.body);
		expect(requests).toHaveLength(2);
	});

	it("throws a network error once retries run out", async () => {
		const { fetch } = replayFetch(new TypeError("fetch failed"));
		await expect(client(fetch, { maxRetries: 1 }).instance.heartbeat(heartbeatBody)).rejects.toBeInstanceOf(PepReviewProNetworkError);
	});

	it("does not retry 4xx other than 429", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("me", "an unknown key"));
		await expect(client(fetch).instance.heartbeat(heartbeatBody)).rejects.toMatchObject({ status: 401, isAuthError: true });
		expect(requests).toHaveLength(1);
	});

	it("throws instead of waiting out a Retry-After longer than allowed", async () => {
		const { fetch, requests } = replayFetch(
			jsonResponse(429, { error: { code: "rate_limited", message: API_ERRORS.rateLimit, request_id: "req_1" } }, { "retry-after": "120" })
		);
		const { instance, sleeps } = client(fetch);
		await expect(instance.heartbeat(heartbeatBody)).rejects.toMatchObject({ status: 429 });
		expect(requests).toHaveLength(1);
		expect(sleeps).toEqual([]);
	});

	it("retries a review submission only when it was refused before the server acted", async () => {
		const body = fixtureCase("submit-review", "a review is saved and waits for its author").request.body as Parameters<
			PepReviewProClient["submitReview"]
		>[0];
		const failed = replayFetch(jsonResponse(500, { success: false, message: "Failed to save review" }));
		await expect(client(failed.fetch).instance.submitReview(body)).rejects.toMatchObject({ status: 500, message: API_ERRORS.failedToSaveReview });
		expect(failed.requests).toHaveLength(1);
		const dropped = replayFetch(new TypeError("socket hang up"));
		await expect(client(dropped.fetch).instance.submitReview(body)).rejects.toBeInstanceOf(PepReviewProNetworkError);
		expect(dropped.requests).toHaveLength(1);
		const limited = replayFetch(rateLimited, fixtureCase("submit-review", "a review is saved and waits for its author"));
		await expect(client(limited.fetch).instance.submitReview(body)).resolves.toMatchObject({ success: true });
		expect(limited.requests).toHaveLength(2);
	});

	it("retries a write whose first try is still running, with the same Idempotency-Key", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("vendor-miss", "the same Idempotency-Key while the first is still running"), heartbeatOk);
		const { instance, sleeps } = client(fetch);
		await expect(instance.heartbeat(heartbeatBody)).resolves.toEqual(heartbeatOk.response.body);
		expect(requests).toHaveLength(2);
		expect(sleeps).toEqual([250]);
		expect(requests[1]?.headers.get("idempotency-key")).toBe(requests[0]?.headers.get("idempotency-key"));
	});

	it("never retries a key reused with another body", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("vendor-miss", "the same Idempotency-Key with another body"), heartbeatOk);
		await expect(client(fetch).instance.heartbeat(heartbeatBody, { idempotencyKey: "beat-1" })).rejects.toMatchObject({
			status: 422,
			code: "idempotency_key_reused"
		});
		expect(requests).toHaveLength(1);
	});

	it("times out an attempt that never answers", async () => {
		const hang: typeof fetch = (_input, init) =>
			new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason as Error)));
		await expect(client(hang, { timeoutMs: 10, maxRetries: 0 }).instance.heartbeat(heartbeatBody)).rejects.toThrow(/Timed out after 10 ms/);
	});

	it("stops at once when the caller aborts", async () => {
		const controller = new AbortController();
		controller.abort(new Error("caller gave up"));
		const { fetch, requests } = replayFetch(heartbeatOk);
		const hang: typeof fetch = (input, init) => (init?.signal?.aborted ? Promise.reject(init.signal.reason as Error) : fetch(input, init));
		await expect(client(hang).instance.heartbeat(heartbeatBody, { signal: controller.signal })).rejects.toThrow("caller gave up");
		expect(requests).toHaveLength(0);
	});
});
