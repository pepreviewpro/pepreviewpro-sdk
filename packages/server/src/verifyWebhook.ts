import type { WebhookEvent } from "@pepreviewpro/core";
import { decodeBase64 } from "./decodeBase64";
import { readHeader } from "./readHeader";
import type { HeadersLike } from "./types";
import { webhookKey } from "./webhookKey";
import { WebhookVerificationError } from "./WebhookVerificationError";

export interface VerifyWebhookOptions {
	/** The `whsec_…` secret shown once when the endpoint was saved. */
	secret: string;
	/** Default 300, the Standard Webhooks tolerance. */
	toleranceSeconds?: number | undefined;
	/** Unix milliseconds. For tests. */
	now?: number | undefined;
}

const encoder = new TextEncoder();

function header(headers: HeadersLike, name: string): string {
	const value = readHeader(headers, name)?.trim();
	if (!value) {
		throw new WebhookVerificationError(`Missing ${name} header.`);
	}

	return value;
}

/**
 * Checks a delivery's Standard Webhooks signature and timestamp, then parses it. `rawBody` must be the bytes as
 * received: re-serialized JSON changes them and fails the check. Uses Web Crypto, so it runs on Node, Bun, Deno, and
 * edge runtimes alike; `crypto.subtle.verify` compares in constant time.
 */
export async function verifyWebhook(rawBody: string | Uint8Array, headers: HeadersLike, options: VerifyWebhookOptions): Promise<WebhookEvent> {
	if (typeof rawBody !== "string" && !(rawBody instanceof Uint8Array)) {
		throw new TypeError("Pass the raw request body as a string or bytes, like `await request.text()`, not parsed JSON.");
	}

	const id = header(headers, "webhook-id");
	const timestamp = header(headers, "webhook-timestamp");
	const signatures = header(headers, "webhook-signature");
	const sentAt = Number(timestamp);
	if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(sentAt)) {
		throw new WebhookVerificationError("Invalid webhook-timestamp header.");
	}

	const now = Math.floor((options.now ?? Date.now()) / 1000);
	const tolerance = options.toleranceSeconds ?? 300;
	if (now - sentAt > tolerance) {
		throw new WebhookVerificationError("Message timestamp too old.");
	}

	if (sentAt - now > tolerance) {
		throw new WebhookVerificationError("Message timestamp too new.");
	}

	const key = await webhookKey(options.secret, "verify");
	const body = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
	const signed = encoder.encode(`${id}.${timestamp}.${body}`);
	const candidates = signatures
		.split(" ")
		.map((entry) => entry.split(","))
		.filter(([version, signature]) => version === "v1" && signature);
	for (const [, signature = ""] of candidates) {
		let bytes: Uint8Array<ArrayBuffer>;
		try {
			bytes = decodeBase64(signature);
		} catch {
			continue;
		}

		if (await globalThis.crypto.subtle.verify("HMAC", key, bytes, signed)) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(body);
			} catch {
				throw new WebhookVerificationError("The webhook body is not JSON.");
			}

			return { ...(parsed as Omit<WebhookEvent, "id">), id } as WebhookEvent;
		}
	}

	throw new WebhookVerificationError("No matching signature found.");
}
