import { Webhook } from "standardwebhooks";
import { describe, expect, it } from "vitest";
import { PepReviewPro, signWebhook, verifyWebhook, WebhookVerificationError } from "../src";

/** The reference vector from the Standard Webhooks spec and its official libraries' tests. */
const VECTOR = {
	secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
	id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
	timestamp: 1_614_265_330,
	payload: '{"test": 2432232314}',
	signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
};

const vectorHeaders = (overrides: Record<string, string> = {}) => ({
	"webhook-id": VECTOR.id,
	"webhook-timestamp": String(VECTOR.timestamp),
	"webhook-signature": VECTOR.signature,
	...overrides
});
const atVectorTime = { secret: VECTOR.secret, now: VECTOR.timestamp * 1000 };

const event = {
	type: "review.published",
	timestamp: "2026-11-02T16:00:00.000Z",
	data: {
		store: "magnolia-store",
		id: "00000000-0000-4000-8000-000000000004",
		reviewer_name: "Riley K.",
		rating: 5,
		title: null,
		body: "Arrived in two days.",
		is_verified: true,
		created_at: "2026-11-02T15:00:00.000000+00:00",
		product_ref: "sku-101",
		order_ref: "ORD-1001",
		updated_at: "2026-11-02T15:59:00.000000+00:00"
	}
};

function signed(body: string, secret = VECTOR.secret, at = new Date()) {
	const id = `msg_${crypto.randomUUID()}`;
	const timestamp = Math.floor(at.getTime() / 1000);
	return { id, headers: { "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": new Webhook(secret).sign(id, at, body) } };
}

const rejects = (promise: Promise<unknown>, message: RegExp) =>
	expect(promise).rejects.toThrow(expect.objectContaining({ name: "WebhookVerificationError", message: expect.stringMatching(message) }));

describe("verifyWebhook", () => {
	it("passes the spec's reference vector", async () => {
		await expect(verifyWebhook(VECTOR.payload, vectorHeaders(), atVectorTime)).resolves.toEqual({ test: 2_432_232_314, id: VECTOR.id });
	});

	it("passes a secret without the whsec_ prefix, a signature among several, and Fetch Headers", async () => {
		const headers = new Headers(vectorHeaders({ "webhook-signature": `v1,bm90IHRoaXMgb25l v2,ignored ${VECTOR.signature}` }));
		await expect(verifyWebhook(VECTOR.payload, headers, { ...atVectorTime, secret: VECTOR.secret.slice(6) })).resolves.toHaveProperty("test");
	});

	it("passes bytes as well as a string", async () => {
		await expect(verifyWebhook(new TextEncoder().encode(VECTOR.payload), vectorHeaders(), atVectorTime)).resolves.toHaveProperty("id", VECTOR.id);
	});

	it("fails a changed body, id, or timestamp", async () => {
		await rejects(verifyWebhook('{"test": 2432232315}', vectorHeaders(), atVectorTime), /No matching signature/);
		await rejects(verifyWebhook(VECTOR.payload, vectorHeaders({ "webhook-id": "msg_other" }), atVectorTime), /No matching signature/);
		await rejects(
			verifyWebhook(VECTOR.payload, vectorHeaders({ "webhook-timestamp": String(VECTOR.timestamp + 1) }), atVectorTime),
			/No matching signature/
		);
	});

	it("fails the wrong secret and a signature of another version", async () => {
		await rejects(
			verifyWebhook(VECTOR.payload, vectorHeaders(), { ...atVectorTime, secret: "whsec_dGhlIHdyb25nIHNlY3JldCBlbnRpcmVseQ==" }),
			/No matching/
		);
		await rejects(
			verifyWebhook(VECTOR.payload, vectorHeaders({ "webhook-signature": VECTOR.signature.replace("v1,", "v2,") }), atVectorTime),
			/No matching/
		);
	});

	it("allows 5 minutes either way, and no more", async () => {
		const at = VECTOR.timestamp * 1000;
		await expect(verifyWebhook(VECTOR.payload, vectorHeaders(), { secret: VECTOR.secret, now: at + 299_000 })).resolves.toBeDefined();
		await rejects(verifyWebhook(VECTOR.payload, vectorHeaders(), { secret: VECTOR.secret, now: at + 301_000 }), /too old/);
		await rejects(verifyWebhook(VECTOR.payload, vectorHeaders(), { secret: VECTOR.secret, now: at - 301_000 }), /too new/);
	});

	it("names a missing or malformed header", async () => {
		const { "webhook-signature": _dropped, ...unsigned } = vectorHeaders();
		await rejects(verifyWebhook(VECTOR.payload, unsigned, atVectorTime), /Missing webhook-signature/);
		await rejects(verifyWebhook(VECTOR.payload, vectorHeaders({ "webhook-timestamp": "soon" }), atVectorTime), /Invalid webhook-timestamp/);
	});

	it("refuses parsed JSON, which can never match the signature", async () => {
		await expect(verifyWebhook({ test: 1 } as never, vectorHeaders(), atVectorTime)).rejects.toThrow(TypeError);
	});

	it("agrees with the official library on what passes and what fails", async () => {
		const body = JSON.stringify(event);
		const { headers } = signed(body);
		const official = new Webhook(VECTOR.secret);
		expect(official.verify(body, headers)).toEqual(event);
		await expect(verifyWebhook(body, headers, { secret: VECTOR.secret })).resolves.toMatchObject({
			type: "review.published",
			data: { order_ref: "ORD-1001" }
		});
		const tampered = body.replace("Arrived", "Arrives");
		expect(() => official.verify(tampered, headers)).toThrow();
		await expect(verifyWebhook(tampered, headers, { secret: VECTOR.secret })).rejects.toBeInstanceOf(WebhookVerificationError);
	});
});

describe("webhooks.verify", () => {
	it("verifies with the store's secret and returns the typed event with its id", async () => {
		const body = JSON.stringify(event);
		const { id, headers } = signed(body);
		const sdk = new PepReviewPro({ store: "magnolia-store", webhookSecret: VECTOR.secret, heartbeat: false });
		const verified = await sdk.webhooks.verify(body, headers);
		expect(verified.id).toBe(id);
		if (verified.type === "review.published") {
			expect(verified.data.product_ref).toBe("sku-101");
		}
	});

	it("says which secret is missing", async () => {
		const sdk = new PepReviewPro({ store: "magnolia-store", heartbeat: false });
		await expect(sdk.webhooks.verify("{}", {})).rejects.toThrow(/PEPREVIEWPRO_WEBHOOK_SECRET/);
	});

	it("throws the exported error class", async () => {
		const error = await verifyWebhook("{}", vectorHeaders(), atVectorTime).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(WebhookVerificationError);
	});
});

describe("signWebhook", () => {
	it("signs the spec's reference vector byte for byte", async () => {
		await expect(signWebhook({ secret: VECTOR.secret, body: VECTOR.payload, id: VECTOR.id, timestamp: VECTOR.timestamp })).resolves.toEqual(
			vectorHeaders()
		);
	});

	it("signs what the official library and verifyWebhook accept, with a fresh id and the current time", async () => {
		const body = JSON.stringify(event);
		const headers = await signWebhook({ secret: VECTOR.secret, body });
		expect(headers["webhook-id"]).toMatch(/^msg_/);
		expect(() => new Webhook(VECTOR.secret).verify(body, headers)).not.toThrow();
		await expect(verifyWebhook(body, headers, { secret: VECTOR.secret })).resolves.toMatchObject({ type: "review.published" });
	});
});
