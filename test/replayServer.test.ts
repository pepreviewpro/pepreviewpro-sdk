import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureCase } from "./replay";
import { startReplayServer, type ReplayServer } from "./replayServer";

let server: ReplayServer;

beforeAll(async () => {
	server = await startReplayServer();
});

afterAll(() => server.close());

describe("replay server", () => {
	it("answers with the recording that matches the store and query", async () => {
		const recorded = fixtureCase("widget-data-product-ref", "one product by the store's own id");
		const response = await fetch(`${server.url}/api/v1/widget-data?${recorded.request.query}`);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		await expect(response.json()).resolves.toEqual(recorded.response.body);
		const other = await fetch(`${server.url}/api/v1/widget-data?site_id=example-store`);
		await expect(other.json()).resolves.toEqual(fixtureCase("get-widget-data", "by slug, with the store's minimum rating applied").response.body);
	});

	it("never answers one store with another's recording", async () => {
		const response = await fetch(`${server.url}/api/v1/widget-data?site_id=nobody`);
		expect(response.status).toBe(404);
	});

	it("adds a published review to the store's widget-data", async () => {
		const review = {
			id: "new",
			reviewer_name: "Pat Q.",
			rating: 5,
			title: null,
			body: "Published after the build.",
			is_verified: true,
			created_at: "2026-11-02T16:00:00Z"
		};
		await fetch(`${server.url}/__replay/reviews`, { method: "POST", body: JSON.stringify({ store: "magnolia-store", review }) });
		const body = (await (await fetch(`${server.url}/api/v1/widget-data?site_id=magnolia-store&product_ref=sku-101&limit=20`)).json()) as {
			reviews: { id: string }[];
		};
		expect(body.reviews[0]?.id).toBe("new");
	});

	it("echoes the caller's order ids and serves the runtime", async () => {
		const response = await fetch(`${server.url}/api/v1/orders`, {
			method: "POST",
			body: JSON.stringify({ store: "magnolia-store", orders: [{ id: "EX-1", status: "completed" }] })
		});
		await expect(response.json()).resolves.toEqual({ store: "magnolia-store", results: [expect.objectContaining({ id: "EX-1", status: "created" })] });
		expect(await (await fetch(`${server.url}/embed/widgets.js`)).text()).toContain("data-pepreviews-widget");
	});
});
