import { webhookKey } from "./webhookKey";

export interface SignWebhookOptions {
	/** The endpoint's `whsec_…` secret. */
	secret: string;
	/** The exact body to send. */
	body: string;
	/** Default a fresh `msg_` id. */
	id?: string | undefined;
	/** Unix seconds. Default now. */
	timestamp?: number | undefined;
}

/**
 * The Standard Webhooks headers PepReviewPro sends with a delivery of `body`, for testing a webhook route: `npx
 * pepreviewpro webhooks test` sends a signed `ping` with these.
 */
export async function signWebhook({
	secret,
	body,
	id = `msg_${crypto.randomUUID()}`,
	timestamp
}: SignWebhookOptions): Promise<Record<string, string>> {
	const seconds = String(timestamp ?? Math.floor(Date.now() / 1000));
	const key = await webhookKey(secret, "sign");
	const signature = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${seconds}.${body}`)));
	return { "webhook-id": id, "webhook-timestamp": seconds, "webhook-signature": `v1,${btoa(String.fromCharCode(...signature))}` };
}
