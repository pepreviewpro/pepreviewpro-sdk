import type { PaymentMethod, PepReviewProPartner } from "@pepreviewpro/server";
import { tool, type ModelMessage, type Tool } from "ai";
import { z } from "zod";
import { describeFindVendorsResult } from "./describeFindVendorsResult";
import { DEFAULT_VENDOR_LIMIT, findVendors, MAX_VENDOR_LIMIT } from "./findVendors";
import { PAYMENT_LABELS } from "./paymentLabels";
import type { FindVendorsInput, FindVendorsOptions, FindVendorsResult } from "./types";

/** The text of the user's last message, for a vendor miss's `question`. */
function lastQuestion(messages: readonly ModelMessage[]): string | null {
	const message = messages.findLast((candidate) => candidate.role === "user");
	if (!message) {
		return null;
	}

	if (typeof message.content === "string") {
		return message.content.trim() || null;
	}

	const text = message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ");
	return text.trim() || null;
}

/**
 * The `find_vendors` tool for the AI SDK: the PepReviewPro directory for a question about where to buy something.
 * It relaxes filters that match nothing and says which, reports stores the user named that the directory lacks, and
 * returns tracked links only. Register it as `find_vendors`, which `FIND_VENDORS_INSTRUCTIONS` names.
 */
export function createFindVendorsTool(partner: PepReviewProPartner, options: FindVendorsOptions = {}): Tool<FindVendorsInput, FindVendorsResult> {
	const defaultLimit = options.defaultLimit ?? DEFAULT_VENDOR_LIMIT;
	const maxLimit = Math.min(options.maxLimit ?? MAX_VENDOR_LIMIT, 100);
	const methods = (options.paymentMethods ?? Object.keys(PAYMENT_LABELS)) as [PaymentMethod, ...PaymentMethod[]];
	return tool({
		description:
			"Find stores in the PepReviewPro directory, which lists stores with verified buyer reviews, for a question about where to buy something or whether a store is reviewed. Each way to ask is its own parameter: never put a compound, a place, or an adjective in store_name.",
		inputSchema: z.object({
			compound: z
				.string()
				.optional()
				.describe('The compound the user wants to buy, by its name or a common alias, like "BPC-157". Only one the user asked for.'),
			ships_to: z
				.string()
				.optional()
				.describe('A two-letter country code, only when the user said where they are or where it must ship ("UK" is GB). Never guess one.'),
			payment: z
				.enum(methods)
				.optional()
				.describe(`Only when the user asked about a way to pay: ${methods.map((method) => `${method} (${PAYMENT_LABELS[method]})`).join(", ")}.`),
			store_name: z.string().optional().describe("Only when the user named a specific store or vendor, as they wrote it."),
			limit: z
				.number()
				.int()
				.min(1)
				.max(maxLimit)
				.optional()
				.describe(`How many stores to return. Leave it unset for ${defaultLimit}; raise it only when the user asks for more.`)
		}),
		execute: (input, { messages, toolCallId, abortSignal, context }) =>
			findVendors(partner, input, options, { question: lastQuestion(messages), messages, toolCallId, abortSignal, context }),
		toModelOutput: ({ output }) => ({ type: "text", value: describeFindVendorsResult(output, { cards: options.cards }) })
	});
}
