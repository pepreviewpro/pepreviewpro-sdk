import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch, type RecordedRequest } from "../../../test/replay";
import { PepReviewPro, VERSION } from "../src";

const beat = fixtureCase("heartbeat", "records the install, dropping capabilities it does not know");
const catalogOk = fixtureCase("catalog", "saves the catalog, skipping what does not parse");
let storeCount = 0;

/** A store name no other test has used, since the daily heartbeat is remembered per process. */
const freshStore = () => `heartbeat-store-${++storeCount}`;

function route(request: RecordedRequest) {
	return request.url.pathname === "/api/v1/heartbeat"
		? new Response(JSON.stringify(beat.response.body), { status: 200 })
		: new Response(JSON.stringify(catalogOk.response.body));
}

const heartbeats = (requests: RecordedRequest[]) => requests.filter((request) => request.url.pathname === "/api/v1/heartbeat");

afterEach(() => {
	vi.useRealTimers();
});

describe("heartbeat", () => {
	it("sends the contract's body and returns when it was received", async () => {
		const { fetch, requests } = replayFetch(beat);
		const sdk = new PepReviewPro({
			store: "magnolia-store",
			apiKey: fakeKey(),
			fetch,
			heartbeat: { framework: "next@16.4.2", capabilities: ["webhooks"] }
		});
		await expect(sdk.heartbeat({ capabilities: ["orders"] })).resolves.toEqual({
			receivedAt: (beat.response.body as { received_at: string }).received_at
		});
		expect(requests[0]?.body).toEqual({
			store: "magnolia-store",
			sdk_version: VERSION,
			packages: { "@pepreviewpro/core": "0.0.0-test", "@pepreviewpro/server": "0.0.0-test" },
			framework: "next@16.4.2",
			runtime: `node@${process.versions.node}`,
			capabilities: ["webhooks", "orders"]
		});
	});

	it("beats once a day per process after the first keyed call, with what the process has done", async () => {
		vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-11-02T16:00:00Z") });
		const { fetch, requests } = replayFetch(route);
		const waited: Promise<unknown>[] = [];
		const store = freshStore();
		const sdk = new PepReviewPro({ store, apiKey: fakeKey(), fetch, waitUntil: (promise) => void waited.push(promise) });
		await sdk.catalog.push({ products: [] });
		await Promise.all(waited);
		await sdk.catalog.push({ products: [] });
		await new PepReviewPro({ store, apiKey: fakeKey(), fetch }).catalog.push({ products: [] });
		expect(heartbeats(requests)).toHaveLength(1);
		expect(heartbeats(requests)[0]?.body).toMatchObject({ store, capabilities: ["catalog"] });
		vi.setSystemTime(Date.parse("2026-11-03T16:00:01Z"));
		await sdk.catalog.push({ products: [] });
		await Promise.all(waited);
		expect(heartbeats(requests)).toHaveLength(2);
	});

	it("never beats when turned off or without a key", async () => {
		const { fetch, requests } = replayFetch(route);
		await new PepReviewPro({ store: freshStore(), apiKey: fakeKey(), fetch, heartbeat: false }).catalog.push({ products: [] });
		vi.stubEnv("PEPREVIEWPRO_API_KEY", "");
		await new PepReviewPro({ store: freshStore(), fetch }).reviews.list().catch(() => undefined);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(heartbeats(requests)).toHaveLength(0);
	});

	it("keeps a failed heartbeat from the caller and tries again an hour later", async () => {
		vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-11-02T16:00:00Z") });
		const waited: Promise<unknown>[] = [];
		const { fetch, requests } = replayFetch((request) =>
			request.url.pathname === "/api/v1/heartbeat"
				? jsonResponse(403, fixtureCase("heartbeat", "a key without store:write").response.body)
				: route(request)
		);
		const sdk = new PepReviewPro({ store: freshStore(), apiKey: fakeKey(), fetch, maxRetries: 0, waitUntil: (promise) => void waited.push(promise) });
		await expect(sdk.catalog.push({ products: [] })).resolves.toBeDefined();
		await Promise.all(waited);
		await sdk.catalog.push({ products: [] });
		expect(heartbeats(requests)).toHaveLength(1);
		vi.setSystemTime(Date.parse("2026-11-02T17:00:01Z"));
		await sdk.catalog.push({ products: [] });
		await Promise.all(waited);
		expect(heartbeats(requests)).toHaveLength(2);
	});
});
