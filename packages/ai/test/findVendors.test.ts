import type { PartnerEventsRequest, StoresResponse, VendorMissRequest } from "@pepreviewpro/core";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, replayFetch, type FixtureCase, type RecordedRequest } from "../../../test/replay";
import { createFindVendorsTool, describeFindVendorsResult, FIND_VENDORS_INSTRUCTIONS, findVendors, type FindVendorsResult } from "../src";

const stores = (name: string) => fixtureCase("stores", name);
const allStores = stores("stores with a product for the compound");
const canada = stores("only stores that ship to the country");
const australia = stores("no store ships the compound to the country");
const missed = fixtureCase("vendor-miss", "a store that is not on PepReviewPro");
const shown = fixtureCase("partner-events", "shown stores and a click are recorded, an unknown store and a bad type are skipped");
const recorded = (allStores.response.body as StoresResponse).stores;

/** A partner whose `/stores` reads answer in order, and whose background reports answer from their own recordings. */
function setup(...reads: FixtureCase[]) {
	const background: Promise<unknown>[] = [];
	let read = 0;
	const { fetch, requests } = replayFetch((request: RecordedRequest) => {
		if (request.url.pathname === "/api/v1/vendor-miss") {
			return replayFetch(missed).fetch(request.url, {});
		}

		if (request.url.pathname === "/api/v1/partner-events") {
			return replayFetch(shown).fetch(request.url, {});
		}

		return replayFetch(reads[Math.min(read++, reads.length - 1)]!).fetch(request.url, {});
	});
	const partner = new PepReviewProPartner({ apiKey: fakeKey("pk"), fetch, waitUntil: (promise) => background.push(promise) });
	const settled = () => Promise.all(background);
	const queries = () => requests.filter((request) => request.url.pathname === "/api/v1/stores").map((request) => request.url.search.slice(1));
	return { partner, requests, settled, queries };
}

/** A model that calls `find_vendors` once with `input`, then answers in text. */
function scriptedModel(input: Record<string, unknown>) {
	const usage = {
		inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 5, text: 5, reasoning: 0 }
	};
	return new MockLanguageModelV4({
		doGenerate: [
			{
				content: [{ type: "tool-call", toolCallId: "call-1", toolName: "find_vendors", input: JSON.stringify(input) }],
				finishReason: { unified: "tool-calls", raw: "tool_calls" },
				usage,
				warnings: []
			},
			{ content: [{ type: "text", text: "Here are the stores." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] }
		]
	});
}

const question: ModelMessage[] = [{ role: "user", content: "Where can I buy BPC-157 shipped to Canada?" }];

describe("createFindVendorsTool", () => {
	it("runs in a conversation: the tool reads the directory, and the model reads the facts", async () => {
		const { partner, queries } = setup(canada);
		const model = scriptedModel({ compound: "BPC-157", ships_to: "CA" });
		const result = await generateText({
			model,
			system: FIND_VENDORS_INSTRUCTIONS,
			messages: question,
			tools: { find_vendors: createFindVendorsTool(partner, { resolveCompound: (text) => text.toLowerCase() }) },
			stopWhen: stepCountIs(2)
		});
		expect(queries()).toEqual([canada.request.query]);
		const output = result.steps[0]!.toolResults[0]!.output as FindVendorsResult;
		expect(output.applied.map((filter) => [filter.kind, filter.label])).toEqual([
			["compound", "bpc-157"],
			["shipsTo", "Canada"]
		]);
		expect(output.dropped).toEqual([]);
		expect(output.stores.map((store) => store.slug)).toEqual(["example-store"]);
		expect(output.stores[0]).toMatchObject({ link: recorded[0]!.click_url, profileUrl: recorded[0]!.profile_url, shipsTo: "Canada" });
		const [best] = recorded[0]!.matched_products!;
		expect(output.stores[0]!.product).toMatchObject({ name: best!.name, inStock: true, link: best!.click_url });
		expect(output.stores[0]!.moreProducts).toBe(recorded[0]!.matched_product_count! - 1);
		const toolMessage = JSON.stringify(model.doGenerateCalls[1]!.prompt.find((message) => message.role === "tool"));
		expect(toolMessage).toContain("Facts: 1 store lists a bpc-157 product and ships to Canada.");
		expect(result.text).toBe("Here are the stores.");
	});

	it("describes its input for the model and bounds the limit", async () => {
		const tool = createFindVendorsTool(setup(allStores).partner, { defaultLimit: 2, maxLimit: 4, paymentMethods: ["card", "crypto"] });
		expect(tool.description).toMatch(/never put a compound, a place, or an adjective in store_name/);
		const schema = tool.inputSchema as unknown as { safeParse: (value: unknown) => { success: boolean } };
		expect(schema.safeParse({ limit: 4, payment: "crypto" }).success).toBe(true);
		expect(schema.safeParse({ limit: 5 }).success).toBe(false);
		expect(schema.safeParse({ payment: "zelle" }).success).toBe(false);
	});
});

describe("findVendors", () => {
	it("lets go of the country when nothing ships there, and says so", async () => {
		const { partner, queries } = setup(australia, allStores);
		const result = await findVendors(partner, { compound: "bpc-157", ships_to: "au" });
		expect(queries()).toEqual([australia.request.query, allStores.request.query]);
		expect(result.applied.map((filter) => filter.kind)).toEqual(["compound"]);
		expect(result.dropped).toEqual([{ kind: "shipsTo", value: "AU", label: "Australia" }]);
		expect(result.stores.map((store) => store.shipsTo)).toEqual([null, null]);
		expect(describeFindVendorsResult(result)).toContain(
			"Facts: No store in the directory lists Australia in its shipping countries, so these 2 stores are the top rated with no shipping filter. All 2 list a bpc-157 product."
		);
	});

	it("tries at most four filter sets, then reports that nothing matches", async () => {
		const { partner, queries } = setup(australia);
		const result = await findVendors(partner, { compound: "bpc-157", ships_to: "AU", payment: "zelle" });
		expect(queries()).toEqual([
			"compound=bpc-157&ships_to=AU&payment=zelle&sort=best&limit=3",
			"compound=bpc-157&sort=best&limit=3",
			"ships_to=AU&payment=zelle&sort=best&limit=3",
			"sort=best&limit=3"
		]);
		expect(result).toMatchObject({ stores: [], applied: [], empty: true });
		expect(result.dropped.map((filter) => filter.kind)).toEqual(["compound", "shipsTo", "payment"]);
		expect(describeFindVendorsResult(result)).toMatch(/^Facts: Nothing in the directory matches\./);
	});

	it("lets go of a compound the API says it does not know after one read, and says so", async () => {
		const unknown = stores("a compound outside the library matches nothing");
		const { partner, queries } = setup(unknown, allStores);
		const result = await findVendors(partner, { compound: "unknown" });
		expect(queries()).toEqual([unknown.request.query, "sort=best&limit=3"]);
		expect(result).toMatchObject({ unknownCompound: "unknown", applied: [], dropped: [], empty: false });
		expect(describeFindVendorsResult(result)).toContain("unknown is not a compound the directory knows");
	});

	it("names a compound the host does not know instead of searching for it", async () => {
		const { partner, queries } = setup(allStores);
		const result = await findVendors(partner, { compound: "unknown" }, { resolveCompound: () => null });
		expect(queries()).toEqual(["sort=best&limit=3"]);
		expect(result.unknownCompound).toBe("unknown");
		expect(describeFindVendorsResult(result)).toContain("unknown is not a compound the directory knows");
	});

	it("reports a store the user named that the directory lacks, with their question, and finds no alternatives unasked", async () => {
		const { partner, requests, settled, queries } = setup(stores("no store by that name"));
		const result = await findVendors(
			partner,
			{ store_name: "Juniper" },
			{},
			{
				question: "Is Juniper legit? https://juniper-store.example",
				messages: [],
				toolCallId: null,
				context: undefined,
				abortSignal: undefined
			}
		);
		await settled();
		expect(queries()).toEqual(["search=Juniper&sort=best&limit=3"]);
		expect(result).toMatchObject({ notInDirectory: "Juniper", storeName: "Juniper", stores: [], empty: false });
		const miss = requests.find((request) => request.url.pathname === "/api/v1/vendor-miss")!.body as VendorMissRequest;
		expect(miss).toEqual({ name: "Juniper", url: "https://juniper-store.example", question: "Is Juniper legit? https://juniper-store.example" });
		expect(describeFindVendorsResult(result)).toContain("Juniper is not reviewed on PepReviewPro. No reviewed alternatives were looked up.");
	});

	it("leaves the question out of a miss when asked to", async () => {
		const { partner, requests, settled } = setup(stores("no store by that name"));
		const context = { question: "Is Juniper legit?", messages: [], toolCallId: null, context: undefined, abortSignal: undefined };
		await findVendors(partner, { store_name: "Juniper" }, { reportMisses: { includeQuestion: false } }, context);
		await settled();
		expect(requests.find((request) => request.url.pathname === "/api/v1/vendor-miss")!.body).toEqual({ name: "Juniper" });
	});

	it("finds a named store that carries the compound in one read", async () => {
		const byName = stores("stores by name, with the compound");
		const { partner, queries } = setup(byName);
		const result = await findVendors(partner, { store_name: "Olive Store", compound: "bpc-157" });
		const params = (query: string) => Object.fromEntries(new URLSearchParams(query));
		expect(queries().map(params)).toEqual([params(byName.request.query)]);
		expect(result).toMatchObject({ storeName: "Olive Store", notInDirectory: null, dropped: [] });
		expect(result.stores[0]?.product?.name).toBe("BPC-157 10mg");
		expect(describeFindVendorsResult(result)).toContain("1 store in the directory matches the name Olive Store. It lists a bpc-157 product.");
	});

	it("uses the host's country when the user named none, and says where it came from", async () => {
		const { partner } = setup(canada);
		const result = await findVendors(partner, { compound: "bpc-157" }, { fallbackCountry: () => "ca" });
		expect(result.shipsToFrom).toBe("fallback");
		expect(describeFindVendorsResult(result)).toContain("The country is a default for this user, not something they said.");
	});

	it("drops a country the API does not take, instead of failing the answer", async () => {
		const { partner, queries } = setup(stores("a country that is not a code"), allStores);
		const result = await findVendors(partner, { compound: "bpc-157", ships_to: "EU" });
		expect(queries()).toEqual(["compound=bpc-157&ships_to=EU&sort=best&limit=3", allStores.request.query]);
		expect(result.stores).toHaveLength(2);
		expect(result.applied.map((filter) => filter.kind)).toEqual(["compound"]);
		expect(result.dropped).toEqual([]);
	});

	it("carries an overlay inside the tracked link when it is on the store's site, and keeps it apart when not", async () => {
		const { partner } = setup(allStores);
		const result = await findVendors(
			partner,
			{ compound: "bpc-157" },
			{
				overlayLinks: (store, product) =>
					store.slug === "example-store"
						? { url: "https://store.example/?ref=partner", productUrl: `${product!.pageUrl}?ref=partner`, discountCode: "PARTNER10" }
						: { url: "https://affiliate.example.com/olive-store" }
			}
		);
		const [example, olive] = result.stores;
		expect(example!.link).toBe(`${recorded[0]!.click_url}?to=${encodeURIComponent("https://store.example/?ref=partner")}`);
		expect(example!.product!.link).toContain("?to=");
		expect(example).toMatchObject({ untrackedUrl: null, discountCode: "PARTNER10" });
		expect(olive).toMatchObject({ link: recorded[1]!.click_url, untrackedUrl: "https://affiliate.example.com/olive-store" });
		expect(describeFindVendorsResult(result)).toContain("discount code PARTNER10");
	});

	it("reports the stores it returns as shown when asked", async () => {
		const { partner, requests, settled } = setup(allStores);
		await findVendors(partner, { compound: "bpc-157" }, { reportShown: true });
		await settled();
		const sent = requests.find((request) => request.url.pathname === "/api/v1/partner-events")!.body as PartnerEventsRequest;
		expect(sent.events).toEqual([
			{ id: expect.stringMatching(/^prp_/), type: "shown", store: "example-store", compound: "bpc-157", placement: "finderStore" },
			{ id: expect.stringMatching(/^prp_/), type: "shown", store: "olive-store", compound: "bpc-157", placement: "finderStore" }
		]);
	});

	it("tells the model each store's star rating, not its ranking score", async () => {
		const { partner } = setup(allStores);
		const text = describeFindVendorsResult(await findVendors(partner, { compound: "bpc-157" }));
		const [first] = recorded;
		expect(text).toContain(`${first!.name}: rated ${first!.rating.toFixed(2)} out of 5 from ${first!.review_count} reviews`);
		expect(text).toContain(`${first!.matched_product_count! - 1} more matching products`);
		expect(text).not.toContain("score");
	});

	it("links the stores' own pages on a key no partner is linked to", async () => {
		const unlinked = stores("a key no partner is linked to gets no click_url");
		const { partner } = setup(unlinked);
		const result = await findVendors(partner, { compound: "tb-500" });
		const [store] = (unlinked.response.body as StoresResponse).stores;
		expect(result.stores[0]).toMatchObject({ link: store!.website_url, untrackedUrl: null });
		expect(result.stores[0]?.product?.link).toBe(store!.matched_products![0]!.page_url);
	});

	it("gives the model each tracked link to write when the host draws no cards", async () => {
		const { partner } = setup(allStores);
		const text = describeFindVendorsResult(await findVendors(partner, { compound: "bpc-157" }), { cards: false });
		expect(text).toContain(`link ${recorded[0]!.click_url}`);
		expect(text).toContain("Link a store or product only with its link above, exactly as given.");
		expect(text).not.toContain("card");
	});
});
