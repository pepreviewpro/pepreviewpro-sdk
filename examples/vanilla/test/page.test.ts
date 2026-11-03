import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fixtureCase, replayFetch } from "../../../test/replay";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../../test/fixtures/runtime/widgets.js", import.meta.url), "utf8");
const recorded = fixtureCase("widget-data-product-ref", "one product by the store's own id");

describe("the vanilla page", () => {
	it("fetches the store's public reviews and prints the runtime's host for them", async () => {
		const { fetch, requests } = replayFetch(recorded);
		const dom = new JSDOM(html, {
			runScripts: "dangerously",
			url: "https://store.example/reviews",
			beforeParse: (window) => {
				window.fetch = fetch;
			}
		});
		const host = await vi.waitFor(() => {
			const found = dom.window.document.querySelector("[data-pepreviews-widget]");
			expect(found).toBeTruthy();
			return found!;
		});
		expect(requests[0]?.url.toString()).toBe("https://pepreviewpro.com/api/v1/widget-data?site_id=magnolia-store");
		const payload = JSON.parse(host.getAttribute("data-pepreviews-widget")!);
		const body = recorded.response.body as Record<string, { app_url?: string }>;
		expect(payload).toEqual({
			type: "carousel",
			options: {},
			data: { app_url: body["store"]!.app_url, store: body["store"], settings: body["settings"], reviews: body["reviews"], aggregate: body["aggregate"] }
		});
		dom.window.eval(runtime);
		expect(host.shadowRoot?.querySelector(".pep-widget")?.getAttribute("data-widget-type")).toBe("carousel");
		expect(html).toContain('<script src="https://pepreviewpro.com/embed/widgets.js" defer></script>');
	});
});
