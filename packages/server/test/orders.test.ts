import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch, type RecordedRequest } from "../../../test/replay";
import { ImportError, PepReviewPro, type Order } from "../src";

const created = fixtureCase("orders", "a string id gets a surrogate and its completed order queues the campaign");
const recordedOrder = (created.request.body as { orders: Record<string, unknown>[] }).orders[0]!;
/** Echoes every order back as created, the way the API answers a batch. */
const echo = (request: RecordedRequest) => {
	const { orders } = request.body as { orders: { id: string | number }[] };
	return jsonResponse(200, {
		store: "example-store",
		results: orders.map((order) => ({ id: String(order.id), status: "created", queued: 0, duplicates: 0 }))
	});
};

function sdk(fetchImpl: typeof fetch, store = "example-store") {
	return new PepReviewPro({ store, apiKey: fakeKey(), fetch: fetchImpl, heartbeat: false, maxRetries: 0 });
}

const order = (id: number | string): Order => ({ id, status: "completed", email: `buyer${id}@example.com` });

const recordedStore = (created.request.body as { store: string }).store;

/** The recorded order in the SDK's own names, without what the checkout request supplies. */
const checkoutOrder: Order = {
	id: recordedOrder["id"] as string,
	status: "completed",
	email: recordedOrder["email"] as string,
	name: recordedOrder["name"] as string,
	customerId: recordedOrder["customer_id"] as string,
	total: recordedOrder["total"] as number,
	currency: recordedOrder["currency"] as string,
	lineItems: (recordedOrder["line_items"] as Record<string, unknown>[]).map((item) => ({
		productId: item["product_id"] as string,
		variationId: item["variation_id"] as null,
		name: item["name"] as string,
		quantity: item["quantity"] as number,
		total: item["total"] as number
	})),
	createdAt: recordedOrder["created_at"] as string,
	paidAt: new Date(recordedOrder["paid_at"] as string),
	completedAt: recordedOrder["completed_at"] as string
};

describe("orders.upsert", () => {
	it("fills the recorded body from the checkout request's cookies, IP, and user agent", async () => {
		const { fetch, requests } = replayFetch(created);
		const request = new Request("https://store.example/api/checkout", {
			method: "POST",
			headers: {
				"cookie": `prp_attribution=${encodeURIComponent(JSON.stringify(recordedOrder["attribution"]))}; prp_reviews_seen=${recordedOrder["reviews_seen_at"]}`,
				"x-forwarded-for": "203.0.113.7, 198.51.100.1",
				"user-agent": recordedOrder["customer_user_agent"] as string
			}
		});
		const outcome = await sdk(fetch, recordedStore).orders.upsert(checkoutOrder, { request });
		expect(outcome).toEqual({ id: recordedOrder["id"], status: "created", queued: 1, duplicates: 0 });
		expect(requests[0]?.body).toEqual({
			...(created.request.body as object),
			import: false,
			orders: [{ ...recordedOrder, paid_at: "2026-11-02T14:00:05.000Z" }]
		});
	});

	it("lets the order's own fields win over the request", async () => {
		const { fetch, requests } = replayFetch(echo);
		const request = { headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0", "cookie": "prp_reviews_seen=1762092000" } };
		await sdk(fetch).orders.upsert({ ...order(1), customerIp: "198.51.100.4", reviewsSeenAt: new Date(1_762_000_000_000) }, { request });
		expect(requests[0]?.body).toMatchObject({
			orders: [{ customer_ip: "198.51.100.4", customer_user_agent: "Mozilla/5.0", reviews_seen_at: 1_762_000_000 }]
		});
	});

	it("takes the browser's checkout context when checkout runs elsewhere", async () => {
		const { fetch, requests } = replayFetch(echo);
		const attribution = { ...(recordedOrder["attribution"] as object) } as never;
		await sdk(fetch).orders.upsert(order(1), { context: { attribution, reviews_seen_at: 1_762_092_000 } });
		expect(requests[0]?.body).toMatchObject({ orders: [{ attribution, reviews_seen_at: 1_762_092_000 }] });
	});

	it("leaves out what the order does not say, so a status change never clears the first send", async () => {
		const { fetch, requests } = replayFetch(echo);
		await sdk(fetch).orders.upsert({ id: "ORD-1001", status: "refunded", name: null });
		expect(requests[0]?.body).toEqual({ store: "example-store", import: false, orders: [{ id: "ORD-1001", status: "refunded", name: null }] });
	});

	it("returns one outcome per order, with the ids as strings, and the skipped reason", async () => {
		const notTrigger = fixtureCase("orders", "a paid order on a completed trigger and a pending one queue nothing");
		const [paid, pending] = (notTrigger.response.body as { results: { id: string }[] }).results;
		const { fetch } = replayFetch(notTrigger);
		await expect(
			sdk(fetch, recordedStore).orders.upsert([
				{ id: paid!.id, status: "paid" },
				{ id: pending!.id, status: "pending" }
			])
		).resolves.toEqual([
			{ id: paid!.id, status: "created", queued: 0, duplicates: 0, skippedReason: "not_trigger_status" },
			{ id: pending!.id, status: "created", queued: 0, duplicates: 0, skippedReason: "not_trigger_status" }
		]);
	});

	it("splits more than 200 orders into calls of 200, each with its own idempotency key", async () => {
		const { fetch, requests } = replayFetch(echo);
		const outcomes = await sdk(fetch).orders.upsert(
			Array.from({ length: 450 }, (_, index) => order(index + 1)),
			{ idempotencyKey: "batch-7" }
		);
		expect(outcomes).toHaveLength(450);
		expect(requests.map((request) => (request.body as { orders: unknown[] }).orders.length)).toEqual([200, 200, 50]);
		expect(requests.map((request) => request.headers.get("idempotency-key"))).toEqual(["batch-7:0", "batch-7:1", "batch-7:2"]);
	});

	it("refuses a bad id or date before sending", async () => {
		const { fetch, requests } = replayFetch(echo);
		await expect(sdk(fetch).orders.upsert({ id: 0, status: "paid" })).rejects.toThrow(TypeError);
		await expect(sdk(fetch).orders.upsert({ ...order(1), createdAt: "yesterday" })).rejects.toThrow(/createdAt/);
		expect(requests).toHaveLength(0);
	});
});

describe("orders.import", () => {
	async function* generate(count: number) {
		for (let index = 1; index <= count; index++) {
			yield order(index);
		}
	}

	it("sends batches of 200 from an async source as a backfill", async () => {
		const { fetch, requests } = replayFetch(echo);
		const progress: number[] = [];
		const totals = await sdk(fetch).orders.import(generate(450), { onProgress: ({ checkpoint }) => void progress.push(checkpoint.processed) });
		expect(totals).toEqual({ processed: 450, created: 450, updated: 0, unchanged: 0, queued: 0, checkpoint: { processed: 450 } });
		expect(progress).toEqual([200, 400, 450]);
		expect(requests.map((request) => (request.body as { import: boolean }).import)).toEqual([true, true, true]);
		expect((requests[1]?.body as { orders: { id: number }[] }).orders[0]?.id).toBe(201);
	});

	it("queues email for the daily re-send", async () => {
		const { fetch, requests } = replayFetch(echo);
		await sdk(fetch).orders.import([order(1)], { sendEmail: true });
		expect(requests[0]?.body).toMatchObject({ import: false });
	});

	it("stops with the checkpoint before the failed batch, and resumes from it", async () => {
		const failing = replayFetch(
			echo,
			jsonResponse(500, { error: { code: "internal_error", message: "Something failed on our side.", request_id: "req_1" } })
		);
		const error = await sdk(failing.fetch)
			.orders.import(generate(450))
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ImportError);
		expect((error as ImportError).checkpoint).toEqual({ processed: 200 });
		expect(((error as ImportError).cause as { status: number }).status).toBe(500);
		const resumed = replayFetch(echo);
		const totals = await sdk(resumed.fetch).orders.import(generate(450), { checkpoint: (error as ImportError).checkpoint });
		expect(totals).toMatchObject({ processed: 450, created: 250 });
		expect(resumed.requests.map((request) => (request.body as { orders: { id: number }[] }).orders[0]?.id)).toEqual([201, 401]);
	});

	it("honours a smaller batch size and stops when aborted", async () => {
		const { fetch, requests } = replayFetch(echo);
		const controller = new AbortController();
		const error = await sdk(fetch)
			.orders.import(generate(10), { batchSize: 3, onProgress: () => controller.abort(), signal: controller.signal })
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ImportError);
		expect((error as ImportError).checkpoint).toEqual({ processed: 3 });
		expect(requests).toHaveLength(1);
	});
});
