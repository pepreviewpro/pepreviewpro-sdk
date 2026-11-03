import { PepReviewProPartner } from "@pepreviewpro/server";

/** One partner client for the app, with a short budget: a page or a chat turn is waiting. Reads `PEPREVIEWPRO_API_KEY`. */
export const partner = new PepReviewProPartner({ maxRetries: 1, timeoutMs: 5000 });
