import { PepReviewPro, signWebhook } from "@pepreviewpro/server";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebhookHandler, POST } from "../src/entries/webhooks";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const review = {
	store: "magnolia-store",
	id: "00000000-0000-4000-8000-000000000004",
	reviewer_name: "Riley K.",
	rating: 5,
	title: null,
	body: "Arrived in two days.",
	is_verified: true,
	created_at: "2026-11-02T15:00:00.000000+00:00",
	product_ref: "sku-101",
	order_ref: null,
	updated_at: "2026-11-02T15:59:00.000000+00:00"
};

async function delivery(type: string, data: object, signWith = secret): Promise<Request> {
	const body = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
	return new Request("https://store.example/api/pepreviewpro", {
		method: "POST",
		headers: { "content-type": "application/json", ...(await signWebhook({ secret: signWith, body })) },
		body
	});
}

beforeEach(() => {
	vi.mocked(revalidateTag).mockClear();
	vi.stubEnv("PEPREVIEWPRO_WEBHOOK_SECRET", secret);
});

describe("POST", () => {
	it("revalidates the store's and the product's tags for a review event", async () => {
		const response = await POST(await delivery("review.published", review));
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			received: true,
			type: "review.published",
			revalidated: ["pepreviewpro:magnolia-store", "pepreviewpro:magnolia-store:product:sku-101"]
		});
		expect(vi.mocked(revalidateTag).mock.calls).toEqual([
			["pepreviewpro:magnolia-store", "max"],
			["pepreviewpro:magnolia-store:product:sku-101", "max"]
		]);
	});

	it("revalidates the whole store for events that name no product", async () => {
		for (const [type, data] of [
			["review.deleted", { store: "magnolia-store", id: review.id }],
			["aggregate.changed", { store: "magnolia-store", average: 4.8, total: 812, distribution: { 1: 3, 2: 4, 3: 10, 4: 60, 5: 735 } }],
			["store.updated", { store: "magnolia-store", branding: {}, widget_settings: {} }],
			["review.updated", { ...review, product_ref: null }]
		] as const) {
			expect((await POST(await delivery(type, data))).status).toBe(200);
		}

		expect(vi.mocked(revalidateTag).mock.calls.every(([tag]) => tag === "pepreviewpro:magnolia-store")).toBe(true);
		expect(revalidateTag).toHaveBeenCalledTimes(4);
	});

	it("answers a ping with 200 and revalidates nothing", async () => {
		const response = await POST(await delivery("ping", { store: "magnolia-store" }));
		expect(response.status).toBe(200);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("answers a bad signature with 401 and acts on nothing", async () => {
		const response = await POST(await delivery("review.published", review, "whsec_dGhlIHdyb25nIHNlY3JldCBlbnRpcmVseQ=="));
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: "No matching signature found." });
		const unsigned = await POST(new Request("https://store.example/api/pepreviewpro", { method: "POST", body: "{}" }));
		expect(unsigned.status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("says which secret is missing", async () => {
		vi.stubEnv("PEPREVIEWPRO_WEBHOOK_SECRET", "");
		const response = await POST(await delivery("ping", {}));
		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: expect.stringMatching(/PEPREVIEWPRO_WEBHOOK_SECRET/) });
	});
});

describe("createWebhookHandler", () => {
	it("calls onEvent after revalidating, with the profile it was given", async () => {
		const order: string[] = [];
		vi.mocked(revalidateTag).mockImplementation(() => {
			order.push("revalidate");
		});
		const onEvent = vi.fn(() => {
			order.push("onEvent");
		});
		const handler = createWebhookHandler({ onEvent, profile: { expire: 0 } });
		await handler(await delivery("review.deleted", { store: "magnolia-store", id: review.id }));
		expect(order).toEqual(["revalidate", "onEvent"]);
		expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "review.deleted", id: expect.stringMatching(/^msg_/) }));
		expect(revalidateTag).toHaveBeenCalledWith("pepreviewpro:magnolia-store", { expire: 0 });
	});

	it("lets a failing onEvent throw, so Next answers 500 and the event is delivered again", async () => {
		const handler = createWebhookHandler({ onEvent: () => Promise.reject(new Error("db down")) });
		await expect(handler(await delivery("ping", {}))).rejects.toThrow("db down");
	});

	it("verifies through a client's webhooks.verify when given one", async () => {
		vi.stubEnv("PEPREVIEWPRO_WEBHOOK_SECRET", "");
		const client = new PepReviewPro({ store: "magnolia-store", webhookSecret: secret, heartbeat: false });
		const verify = vi.spyOn(client.webhooks, "verify");
		const response = await createWebhookHandler({ client })(await delivery("ping", {}));
		expect(response.status).toBe(200);
		expect(verify).toHaveBeenCalledOnce();
	});
});
