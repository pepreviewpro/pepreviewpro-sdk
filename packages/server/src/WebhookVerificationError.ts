/** A webhook failed its Standard Webhooks check. Answer it with a 400 and do not act on it. */
export class WebhookVerificationError extends Error {
	override readonly name = "WebhookVerificationError";
}
