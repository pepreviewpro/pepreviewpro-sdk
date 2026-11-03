import type { WebhookEvent } from "@pepreviewpro/core";
import { verifyWebhook, WebhookVerificationError, type PepReviewPro } from "@pepreviewpro/server";
import { revalidateTag } from "next/cache";
import { cacheTags } from "./cacheTags";
import { readEnv } from "./readEnv";

/** What `revalidateTag` takes as its second argument on Next.js 16: a `cacheLife` profile name, or `{ expire }` in seconds. */
export type RevalidateProfile = string | { expire?: number };

export interface WebhookHandlerOptions {
	/** The endpoint's `whsec_…` secret. Defaults to `PEPREVIEWPRO_WEBHOOK_SECRET`. */
	secret?: string | undefined;
	/** Verify through this client's `webhooks.verify` instead, so its heartbeat reports webhooks. */
	client?: PepReviewPro | undefined;
	/** Runs after the cache is revalidated. A throw answers 500, so PepReviewPro delivers the event again. */
	onEvent?: ((event: WebhookEvent) => void | Promise<void>) | undefined;
	/**
	 * Default `"max"`: the next visit gets the cached page while it refreshes, and the visit after gets the new one.
	 * `{ expire: 0 }` makes the next visit wait for fresh reviews. Next.js 15 takes no profile and ignores it.
	 */
	profile?: RevalidateProfile | undefined;
}

/** The tags an event makes stale. A ping changes nothing. */
function staleTags(event: WebhookEvent): string[] {
	if (event.type === "ping") {
		return [];
	}

	const productRef = event.type === "review.published" || event.type === "review.updated" ? event.data.product_ref : null;
	return cacheTags(event.data.store, productRef);
}

/**
 * A route handler for PepReviewPro's webhooks: checks the Standard Webhooks signature, revalidates the reviews the
 * event changed, then calls `onEvent`. Answers 401 to a bad signature and 200 to everything it accepts, `ping`
 * included.
 */
export function createWebhookHandler(options: WebhookHandlerOptions = {}): (request: Request) => Promise<Response> {
	return async (request) => {
		const secret = options.secret ?? readEnv().webhookSecret;
		if (!options.client && !secret) {
			return Response.json({ error: "Set PEPREVIEWPRO_WEBHOOK_SECRET to the endpoint's whsec_ secret." }, { status: 500 });
		}

		const body = await request.text();
		let event: WebhookEvent;
		try {
			event = options.client
				? await options.client.webhooks.verify(body, request.headers)
				: await verifyWebhook(body, request.headers, { secret: secret! });
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return Response.json({ error: error.message }, { status: 401 });
			}

			throw error;
		}

		const tags = staleTags(event);
		for (const tag of tags) {
			revalidateTag(tag, options.profile ?? "max");
		}

		await options.onEvent?.(event);
		return Response.json({ received: true, type: event.type, revalidated: tags });
	};
}
