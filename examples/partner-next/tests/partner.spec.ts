import { expect, test } from "@playwright/test";
import { fixtureCase } from "../../../test/replay";
import { REPLAY } from "../playwright.config";

interface ReplayedCall {
	method: string;
	path: string;
	query: Record<string, string>;
	body: { events?: { id: string; type: string; store: string; compound?: string }[] };
}

/** The recorded stores, in the API's own names. */
interface RecordedStore {
	slug: string;
	website_url: string | null;
	click_url: string;
	profile_url: string;
}

const recorded = (fixtureCase("stores", "stores with a product for the compound").response.body as { stores: RecordedStore[] }).stores;
const calls = async (request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> }) =>
	(await (await request.get(`${REPLAY}/__replay/requests`)).json()) as ReplayedCall[];
/** An href as React writes it into HTML. */
const href = (url: string) => `href="${url.replace(/&/g, "&amp;")}"`;

test("the directory page links only the tracked links, and reports what it showed", async ({ request }) => {
	const html = await (await request.get("/?compound=bpc-157")).text();
	for (const store of recorded) {
		expect(html).toContain(href(store.click_url));
		expect(html).toContain(href(store.profile_url));
		if (store.website_url) {
			expect(html).not.toContain(href(store.website_url));
		}
	}

	await expect
		.poll(async () => (await calls(request)).filter((call) => call.path === "/api/v1/partner-events").flatMap((call) => call.body.events ?? []))
		.toEqual(
			expect.arrayContaining(
				recorded.map((store) => ({ id: expect.any(String), type: "shown", store: store.slug, compound: "bpc-157", placement: "finderStore" }))
			)
		);
});

test("the chat route answers with find_vendors, whose cards carry tracked links", async ({ request }) => {
	const response = await request.post("/api/chat", {
		data: { messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Where can I buy BPC-157 shipped to Canada?" }] }] }
	});
	expect(response.status()).toBe(200);
	const stream = await response.text();
	const stores = (await calls(request)).filter((call) => call.path === "/api/v1/stores");
	expect(stores.at(-1)?.query).toEqual({ compound: "bpc-157", ships_to: "CA", sort: "best", limit: "3" });
	const example = recorded.find((store) => store.slug === "example-store")!;
	const link = `${example.click_url}?to=${encodeURIComponent("https://store.example/?ref=partner")}`;
	expect(stream).toContain(`"link":"${link}"`);
	expect(stream).toContain('"discountCode":"PARTNER10"');
	expect(stream).toContain("Here are the stores that ship BPC-157 to Canada.");
	expect(stream).not.toContain(`"${example.website_url}"`);
});
