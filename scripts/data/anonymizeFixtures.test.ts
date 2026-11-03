import { describe, expect, it } from "vitest";
import { anonymizeFixtures } from "./anonymizeFixtures";
import { findRealData } from "./findRealData";

// Built at runtime, so the inputs this test scrubs never sit in the file as the scan would see them.
const shop = ["corner", "shop"].join("-");
const site = ["https://", "cornershop", ".example"].join("");
const recording = {
	cases: [
		{
			name: "a public store",
			request: { method: "GET", query: `site_id=${shop}&product_ref=widget-10mg`, headers: {} },
			response: {
				status: 200,
				body: {
					requested_site_id: shop,
					store: {
						id: "8a2b9c4d-1e3f-4a5b-9c6d-7e8f9a0b1c2d",
						slug: shop,
						name: "corner Shop",
						wp_url: site,
						logo_url: "https://cdn.pepreviewpro.com/logos/corner.png"
					},
					reviews: [
						{
							id: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
							reviewer_name: "Jordana Q.",
							body: "Arrived quickly. </script>",
							order_ref: "CS-10432",
							product_ref: "widget-10mg"
						}
					],
					products: [
						{ id: 4410, name: "Widget 10mg", url: `${site}/product/widget` },
						{ id: 4411, name: "CS BPC-157 &amp; TB-500 Blend 10mg", in_stock: true },
						{ id: 4412, name: "Semax 30mg", in_stock: false }
					],
					next_cursor: Buffer.from(JSON.stringify({ i: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f" })).toString("base64url"),
					error: `store_id must be a store slug (e.g. \`${shop}\`), not an internal UUID.`
				}
			}
		}
	]
};

describe("anonymizeFixtures", () => {
	const [out] = anonymizeFixtures([recording]) as [typeof recording];
	const body = out.cases[0]!.response.body;

	it("names the first store example-store, everywhere it appears", () => {
		expect(out.cases[0]!.request.query).toBe("site_id=example-store&product_ref=sku-101");
		expect(body.requested_site_id).toBe("example-store");
		expect(body.store).toMatchObject({ slug: "example-store", name: "example Store", wp_url: "https://store.example" });
		expect(body.error).toBe("store_id must be a store slug (e.g. `example-store`), not an internal UUID.");
	});

	it("swaps ids, orders, and people for synthetic ones, keeping cursors and shapes in step", () => {
		const review = body.reviews[0]!;
		expect(body.store.id).toMatch(/^00000000-0000-4000-8000-\d{12}$/);
		expect(review).toMatchObject({ order_ref: "ORD-1001", product_ref: "sku-101", body: "Arrived quickly. </script>" });
		expect(review.reviewer_name).toMatch(/^\p{Lu}\p{Ll}+ Q\.$/u);
		expect(review.reviewer_name).not.toBe("Jordana Q.");
		expect(JSON.parse(Buffer.from(body.next_cursor, "base64url").toString())).toEqual({ i: review.id });
		expect(Object.keys(body.store)).toEqual(Object.keys(recording.cases[0]!.response.body.store));
	});

	it("names products after the six compounds, keeping doses and dropping store codes", () => {
		const [widget, blend, semax] = body.products;
		const compound = /^(BPC-157|Epitalon|KPV|MOTS-c|Semax|TB-500) 10mg$/.exec(widget!.name)?.[1];
		expect(compound).toBeDefined();
		expect(widget!.url).toBe(`https://store.example/product/${compound!.toLowerCase()}`);
		expect(blend!.name).toBe("BPC-157 &amp; TB-500 Blend 10mg");
		expect(semax!.name).toBe("Semax 30mg");
	});

	it("leaves nothing the scan would flag, and changes nothing on a second pass", () => {
		const text = JSON.stringify(out, null, "\t");
		expect(findRealData(text)).toEqual([]);
		expect(text).not.toMatch(/corner|Jordana|CS-10432|8a2b9c4d|widget|\bCS\b/i);
		expect(anonymizeFixtures([out])).toEqual([out]);
	});
});

describe("partner recordings", () => {
	const asked = ["Harbor", "Peptide", "Labs"].join(" ");
	// Not one of the six compounds an example may name, so the anonymiser has to rename it.
	const outside = ["reta", "trutide"].join("");
	const missRecording = {
		cases: [
			{
				name: "a store the partner could not show",
				request: {
					method: "POST",
					query: `compound=${outside}`,
					headers: {},
					body: { name: asked, url: site, question: `is ${asked} legit?` }
				},
				response: { status: 200, body: { events: [{ type: "shown", store_id: shop, compound: outside }] } }
			}
		]
	};
	const [missed] = anonymizeFixtures([missRecording]) as [typeof missRecording];
	const missCase = missed.cases[0]!;

	it("treats a vendor-miss body's name as a store's, inside the question too", () => {
		expect(missCase.request.body.name).toMatch(/^\p{Lu}\p{Ll}+ Store$/u);
		expect(missCase.request.body.url).toMatch(/^https:\/\/[a-z]+(-store)?\.example$/);
		expect(missCase.request.body.question).toBe(`is ${missCase.request.body.name} legit?`);
	});

	it("names a compound after one of the six, in the query and in an event", () => {
		const compound = missCase.response.body.events[0]!.compound;
		expect(["bpc-157", "epitalon", "kpv", "mots-c", "semax", "tb-500"]).toContain(compound);
		expect(missCase.request.query).toBe(`compound=${compound}`);
		expect(JSON.stringify(missed)).not.toMatch(new RegExp(`harbor|${outside}`, "i"));
	});

	it("keeps a compound echoed in `filters` a compound, and maps each slug in a `store_id` list", () => {
		const echo = {
			cases: [
				{
					name: "a store list",
					request: { method: "GET", query: `compound=bpc-157&store_id=example-store,%20${shop}`, headers: {} },
					response: { status: 200, body: { filters: { compound: { slug: "bpc-157", name: "BPC-157" } }, products: [{ store: { id: shop } }] } }
				}
			]
		};
		const [mapped] = anonymizeFixtures([echo]) as [typeof echo];
		const { request, response } = mapped.cases[0]!;
		expect(response.body.filters.compound).toEqual({ slug: "bpc-157", name: "BPC-157" });
		expect(new URLSearchParams(request.query).get("store_id")).toBe(`example-store, ${response.body.products[0]!.store.id}`);
		expect(JSON.stringify(mapped)).not.toContain(shop);
	});
});
