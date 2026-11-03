import { createFindVendorsTool, FIND_VENDORS_INSTRUCTIONS } from "@pepreviewpro/ai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { model } from "../../../lib/model";
import { partner } from "../../../lib/partner";

const findVendors = createFindVendorsTool(partner, {
	resolveCompound: (text) => (text.trim().toLowerCase() === "bpc" ? "bpc-157" : text),
	overlayLinks: (store) => (store.slug === "example-store" ? { url: "https://store.example/?ref=partner", discountCode: "PARTNER10" } : null)
});

export async function POST(request: Request) {
	const { messages }: { messages: UIMessage[] } = await request.json();
	const result = streamText({
		model,
		system: `You help people compare the stores that sell research compounds.\n\n${FIND_VENDORS_INSTRUCTIONS}`,
		messages: await convertToModelMessages(messages),
		tools: { find_vendors: findVendors },
		stopWhen: stepCountIs(3)
	});
	return result.toUIMessageStreamResponse();
}
