import { createWebhookHandler } from "../createWebhookHandler";

export { createWebhookHandler, type RevalidateProfile, type WebhookHandlerOptions } from "../createWebhookHandler";

/** `export { POST } from "@pepreviewpro/next/webhooks"` in `app/api/pepreviewpro/route.ts`. */
export const POST: (request: Request) => Promise<Response> = createWebhookHandler();
