import { verifyWebhook } from "@pepreviewpro/server";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeKey, fixtureCase, jsonResponse, replayFetch, type RecordedRequest } from "../../../test/replay";
import { checkpointPath } from "../src/checkpointFile";
import { main } from "../src/main";
import { project, testIo } from "./helpers";

const key = fakeKey("sk");
const env = { PEPREVIEWPRO_API_KEY: key, PEPREVIEWPRO_STORE: "magnolia-store" };
const heartbeat = fixtureCase("heartbeat", "records the install, dropping capabilities it does not know");
const echo = (request: RecordedRequest) => {
	const { orders } = request.body as { orders: { id: string | number }[] };
	return jsonResponse(200, {
		store: "magnolia-store",
		results: orders.map((order) => ({ id: String(order.id), status: "created", queued: 1, duplicates: 0 }))
	});
};

const ordersCsv = (count: number) =>
	[
		"id,status,email,created_at,product_id,product_name,quantity,line_total",
		...Array.from({ length: count }, (_, index) => `ORD-${index + 1},completed,b${index}@example.com,2026-01-01T00:00:00Z,semax-30mg,Semax 30mg,1,49`)
	].join("\n");

const sentIds = (requests: RecordedRequest[]) =>
	requests.map((request) => (request.body as { orders: { id: string }[] }).orders.map((order) => order.id));

describe("import-orders", () => {
	it("imports without email, saves its place on failure, and resumes from it", async () => {
		const dir = await project({ "orders.csv": ordersCsv(450) });
		const failing = replayFetch(
			echo,
			jsonResponse(500, { error: { code: "internal_error", message: "Something failed on our side.", request_id: "req_1" } })
		);
		const first = testIo(dir, { env, fetch: failing.fetch });
		expect(await main(["import-orders", "orders.csv"], first)).toBe(1);
		expect(first.errors.join("\n")).toMatch(/Import stopped after 200 orders[\s\S]*Run the same command again/);
		expect(JSON.parse(await readFile(checkpointPath(join(dir, "orders.csv")), "utf8"))).toMatchObject({ processed: 200, store: "magnolia-store" });
		expect(failing.requests.every((request) => (request.body as { import: boolean }).import)).toBe(true);
		const resumed = replayFetch(echo);
		const second = testIo(dir, { env, fetch: resumed.fetch });
		expect(await main(["import-orders", "orders.csv"], second)).toBe(0);
		expect(second.lines[0]).toBe("Resuming after 200 of 450 orders. Pass --restart to start over.");
		expect(sentIds(resumed.requests).map((ids) => ids[0])).toEqual(["ORD-201", "ORD-401"]);
		expect(existsSync(checkpointPath(join(dir, "orders.csv")))).toBe(false);
		expect(second.lines.at(-1)).toBe("Done. 250 new, 0 updated, 0 unchanged.");
	});

	it("sends nothing when a row is bad", async () => {
		const dir = await project({
			"orders.json": JSON.stringify([
				{ id: "ORD-1", status: "completed" },
				{ id: "ORD-2", status: "shipped" }
			])
		});
		const { fetch, requests } = replayFetch(echo);
		const io = testIo(dir, { env, fetch });
		expect(await main(["import-orders", "orders.json"], io)).toBe(1);
		expect(io.errors[0]).toMatch(/1 orders could not be read\. Nothing was sent\.\nOrder 2: status must be one of/);
		expect(requests).toHaveLength(0);
	});

	it("needs the key and store", async () => {
		const dir = await project({ "orders.json": "[]" });
		const io = testIo(dir);
		expect(await main(["import-orders", "orders.json"], io)).toBe(1);
		expect(io.errors[0]).toMatch(/Set PEPREVIEWPRO_API_KEY first/);
	});
});

describe("sync-orders", () => {
	it("re-sends orders from the window with email on, and leaves undated ones out", async () => {
		const orders = [
			{ id: "ORD-1", status: "completed", completedAt: "2026-11-02T10:00:00Z" },
			{ id: "ORD-2", status: "paid", created_at: "2026-10-20T10:00:00Z", paid_at: "2026-11-01T09:00:00Z" },
			{ id: "ORD-3", status: "completed", completed_at: "2026-10-01T10:00:00Z" },
			{ id: "ORD-4", status: "completed" }
		];
		const dir = await project();
		const { fetch, requests } = replayFetch(echo);
		const io = testIo(dir, { env, fetch, readStdin: async () => orders.map((order) => JSON.stringify(order)).join("\n") });
		expect(await main(["sync-orders", "--since", "48h"], io)).toBe(0);
		expect(sentIds(requests)).toEqual([["ORD-1", "ORD-2"]]);
		expect(requests[0]?.body).toMatchObject({ import: false });
		expect(io.lines[0]).toBe("Re-sending 2 orders from the last 48h to magnolia-store. 1 had no date and were left out.");
		expect(io.lines[1]).toMatch(/2 requests queued/);
	});

	it("reads CSV from stdin with --csv", async () => {
		const dir = await project();
		const { fetch, requests } = replayFetch(echo);
		const csv = "id,status,completed_at\nORD-9,completed,2026-11-02T12:00:00Z\n";
		expect(await main(["sync-orders", "--csv"], testIo(dir, { env, fetch, readStdin: async () => csv }))).toBe(0);
		expect(sentIds(requests)).toEqual([["ORD-9"]]);
	});
});

describe("push-catalog", () => {
	it("sends a catalog file in either naming", async () => {
		const recorded = fixtureCase("catalog", "saves the catalog, skipping what does not parse");
		const body = recorded.request.body as { products: unknown[] };
		const file = { ...body, products: [body.products[0]] };
		const dir = await project({ "catalog.json": JSON.stringify(file) });
		const { fetch, requests } = replayFetch(recorded);
		const io = testIo(dir, { env, fetch });
		expect(await main(["push-catalog", "catalog.json"], io)).toBe(0);
		expect(requests[0]?.body).toEqual({ ...file, store: "magnolia-store" });
		expect(io.lines[0]).toBe("Sent 2 products. 0 matched a compound, 1 were skipped.");
	});
});

describe("init", () => {
	it("checks the key with a heartbeat and writes .env.local only after a yes", async () => {
		const dir = await project({ ".gitignore": ".env*.local\n", "package.json": JSON.stringify({ dependencies: { next: "^16.4.2" } }) });
		const { fetch, requests } = replayFetch(heartbeat);
		const io = testIo(dir, { fetch, interactive: true, answers: [key, "magnolia-store", "y"] });
		expect(await main(["init"], io)).toBe(0);
		expect(requests[0]?.body).toMatchObject({ store: "magnolia-store", framework: "next@16.4.2", capabilities: [] });
		expect(io.lines).toContain("This key is secret. Keep it on the server. Never put it in browser code or in a NEXT_PUBLIC_ variable.");
		expect(await readFile(join(dir, ".env.local"), "utf8")).toBe(`PEPREVIEWPRO_API_KEY=${key}\nPEPREVIEWPRO_STORE=magnolia-store\n`);
		expect(io.lines.join("\n")).not.toContain("Add .env.local to .gitignore");
	});

	it("writes nothing when the user says no, or without a terminal", async () => {
		const dir = await project();
		const declined = testIo(dir, { fetch: replayFetch(heartbeat).fetch, interactive: true, answers: [key, "magnolia-store", "n"] });
		expect(await main(["init"], declined)).toBe(0);
		const headless = testIo(dir, { env, fetch: replayFetch(heartbeat).fetch });
		expect(await main(["init"], headless)).toBe(0);
		expect(existsSync(join(dir, ".env.local"))).toBe(false);
		expect(headless.lines).toContain("Add .env.local to .gitignore so the key is never committed.");
	});

	it("stops on a refused key and on a key in the wrong format", async () => {
		const dir = await project();
		const refused = testIo(dir, { env, fetch: replayFetch(fixtureCase("me", "an unknown key")).fetch });
		expect(await main(["init"], refused)).toBe(1);
		expect(refused.errors[0]).toBe("The key was refused: This API key is not valid.");
		const malformed = testIo(dir, { env: { ...env, PEPREVIEWPRO_API_KEY: "prp_abc" } });
		expect(await main(["init"], malformed)).toBe(1);
	});
});

describe("doctor", () => {
	const healthy = (request: RecordedRequest) =>
		request.url.pathname === "/api/v1/widget-data"
			? new Response(JSON.stringify(fixtureCase("widget-data-product-ref", "one product by the store's own id").response.body))
			: new Response(JSON.stringify(fixtureCase("me", "an old-system key reads itself and this month's usage").response.body));

	it("passes a clean setup and fails a key built into the client bundle", async () => {
		const dir = await project({ ".env.local": `PEPREVIEWPRO_API_KEY=${key}\nPEPREVIEWPRO_STORE=magnolia-store\n` });
		await mkdir(join(dir, ".next", "static", "chunks"), { recursive: true });
		await writeFile(join(dir, ".next", "static", "chunks", "main.js"), "console.log('ok')");
		const clean = testIo(dir, { fetch: replayFetch(healthy).fetch });
		expect(await main(["doctor"], clean)).toBe(0);
		expect(clean.lines).toContain("ok    Store magnolia-store is Magnolia Store, with 4 reviews.");
		expect(clean.lines).toContain("ok    The API accepts the key.");
		await writeFile(join(dir, ".next", "static", "chunks", "leak.js"), `fetch(u,{headers:{authorization:"Bearer ${key}"}})`);
		const leaked = testIo(dir, { fetch: replayFetch(healthy).fetch });
		expect(await main(["doctor"], leaked)).toBe(1);
		expect(leaked.errors.join("\n")).toMatch(/A key \(sk_live_aaaa…\) is in the client bundle at chunks\/leak\.js:1/);
		expect(leaked.errors.join("\n")).not.toContain(key);
	});

	it("fails a key under a public prefix", async () => {
		const dir = await project({ ".env": `NEXT_PUBLIC_PEPREVIEWPRO_API_KEY=${key}\nPEPREVIEWPRO_API_KEY=${key}\nPEPREVIEWPRO_STORE=magnolia-store\n` });
		const io = testIo(dir, { fetch: replayFetch(healthy).fetch });
		expect(await main(["doctor"], io)).toBe(1);
		expect(io.errors.join("\n")).toContain("NEXT_PUBLIC_PEPREVIEWPRO_API_KEY would ship the key to the browser");
	});
});

describe("main", () => {
	it("prints help and fails on an unknown command", async () => {
		const io = testIo(await project());
		expect(await main(["publish"], io)).toBe(1);
		expect(io.errors[0]).toMatch(/Unknown command "publish"/);
		const help = testIo(await project());
		expect(await main(["--help"], help)).toBe(0);
		expect(help.lines[0]).toMatch(/Your key is secret and server only/);
	});
});

describe("webhooks test", () => {
	const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
	/** A route that checks the signature the way `@pepreviewpro/next/webhooks` does. */
	const route = (routeSecret: string) => async (request: RecordedRequest) => {
		try {
			const event = await verifyWebhook(JSON.stringify(request.body), request.headers, { secret: routeSecret, now: Date.parse("2026-11-02T16:00:00Z") });
			return jsonResponse(200, { received: true, type: event.type });
		} catch {
			return jsonResponse(401, { error: "No matching signature found." });
		}
	};

	it("sends a signed ping for the store that the route accepts", async () => {
		const dir = await project();
		const { fetch, requests } = replayFetch(route(secret));
		const io = testIo(dir, { env: { ...env, PEPREVIEWPRO_WEBHOOK_SECRET: secret }, fetch });
		expect(await main(["webhooks", "test", "http://localhost:3000/api/pepreviewpro"], io)).toBe(0);
		expect(io.lines[0]).toBe("http://localhost:3000/api/pepreviewpro accepted a signed ping with 200.");
		expect(requests[0]?.body).toEqual({ type: "ping", timestamp: "2026-11-02T16:00:00.000Z", data: { store: "magnolia-store" } });
		expect(requests[0]?.headers.get("webhook-id")).toMatch(/^msg_/);
	});

	it("says the secret is wrong when the route answers 401", async () => {
		const dir = await project();
		const { fetch } = replayFetch(route("whsec_dGhlIHdyb25nIHNlY3JldCBlbnRpcmVseQ=="));
		const io = testIo(dir, { env, fetch });
		expect(await main(["webhooks", "test", "http://localhost:3000/api/pepreviewpro", "--secret", secret], io)).toBe(1);
		expect(io.errors[0]).toMatch(/refused the signature \(401\)/);
	});

	it("needs a URL and a whsec_ secret, and knows only `test`", async () => {
		const dir = await project();
		const io = testIo(dir, { env });
		expect(await main(["webhooks", "test"], io)).toBe(1);
		expect(await main(["webhooks", "test", "http://localhost:3000/api/pepreviewpro", "--secret", "sk_live_nope"], io)).toBe(1);
		expect(await main(["webhooks", "send"], io)).toBe(1);
		expect(io.errors).toEqual([
			expect.stringMatching(/Pass the route's URL/),
			expect.stringMatching(/whsec_ secret/),
			expect.stringMatching(/webhooks test <url>/)
		]);
	});
});
