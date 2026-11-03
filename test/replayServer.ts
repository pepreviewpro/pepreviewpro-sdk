import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { join } from "node:path";
import { FIXTURE_ENDPOINTS, loadFixture, type FixtureCase } from "./replay";

export interface ReplayedRequest {
	method: string;
	path: string;
	query: Record<string, string>;
	body: unknown;
}

export interface ReplayServer {
	url: string;
	requests: ReplayedRequest[];
	close: () => Promise<void>;
}

export interface ReplayServerOptions {
	port?: number | undefined;
	/** A real `widgets.js` to serve instead of the stand-in. */
	runtimeFile?: string | undefined;
}

/** Store keys a case must match exactly to answer, so one store's recording never answers for another. */
const STORE_KEYS = ["site_id", "store", "store_id"];
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, PUT, OPTIONS" };

function storeOf(entry: { query: Record<string, string>; body: unknown }): string | undefined {
	const body = entry.body && typeof entry.body === "object" ? (entry.body as Record<string, unknown>) : {};
	const value = STORE_KEYS.map((key) => entry.query[key] ?? body[key]).find((found) => typeof found === "string");
	return value as string | undefined;
}

/**
 * The recorded case that best answers a request: same path, method, and store, then the most query params in
 * common. A write for a store no recording names gets the closest recording, with its store swapped in by the caller.
 */
function bestCase(cases: (FixtureCase & { path: string })[], request: ReplayedRequest): FixtureCase | null {
	const store = storeOf(request);
	const candidates = cases
		.filter((item) => item.path === request.path && item.request.method === request.method)
		.map((item) => ({ item, query: Object.fromEntries(new URLSearchParams(item.request.query)) }));
	const sameStore = candidates.filter(({ item, query }) => storeOf({ query, body: item.request.body }) === store);
	const scored = (sameStore.length > 0 || request.method === "GET" ? sameStore : candidates)
		.map(({ item, query }) => {
			const keys = new Set([...Object.keys(query), ...Object.keys(request.query)]);
			const same = [...keys].filter((key) => query[key] === request.query[key]).length;
			return { item, score: same - (keys.size - same) + (item.response.status === 200 ? 0.5 : 0) };
		})
		.sort((a, b) => b.score - a.score);
	return scored[0]?.item ?? null;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(chunk as Buffer);
	}

	const text = Buffer.concat(chunks).toString("utf8");
	if (!text) {
		return undefined;
	}

	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

/**
 * An HTTP stand-in for https://pepreviewpro.com that answers `/api/v1/*` from the recorded fixtures, serves the
 * widget runtime, and records every call. `POST /__replay/reviews` with `{ store, review }` publishes a review, as
 * approving one in the dashboard would; `GET /__replay/requests` lists the calls so far.
 */
export async function startReplayServer(options: ReplayServerOptions = {}): Promise<ReplayServer> {
	const cases = FIXTURE_ENDPOINTS.flatMap((endpoint) => {
		const fixture = loadFixture(endpoint);
		return fixture.cases.map((item) => ({ ...item, path: fixture.path }));
	});
	const runtime = readFileSync(options.runtimeFile ?? join(import.meta.dirname, "fixtures", "runtime", "widgets.js"), "utf8");
	const published = new Map<string, unknown[]>();
	const requests: ReplayedRequest[] = [];
	const server = createServer(async (incoming, outgoing) => {
		const url = new URL(incoming.url ?? "/", "http://replay");
		const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
			outgoing.writeHead(status, { "content-type": "application/json", ...CORS, ...headers });
			outgoing.end(typeof body === "string" ? body : JSON.stringify(body));
		};

		if (incoming.method === "OPTIONS") {
			send(204, "");
			return;
		}

		const request: ReplayedRequest = {
			method: incoming.method ?? "GET",
			path: url.pathname,
			query: Object.fromEntries(url.searchParams),
			body: await readBody(incoming)
		};
		if (url.pathname === "/embed/widgets.js") {
			send(200, runtime, { "content-type": "text/javascript" });
			return;
		}

		if (url.pathname === "/__replay/requests") {
			send(200, requests);
			return;
		}

		if (url.pathname === "/__replay/reviews" && request.method === "POST") {
			const { store, review } = request.body as { store: string; review: unknown };
			published.set(store, [review, ...(published.get(store) ?? [])]);
			send(200, { published: true });
			return;
		}

		requests.push(request);
		const found = bestCase(cases, request);
		if (!found) {
			send(404, { success: false, message: "Store not found" });
			return;
		}

		let body = found.response.body as Record<string, unknown>;
		const store = storeOf(request);
		if (request.path === "/api/v1/widget-data" && store && published.has(store)) {
			const extra = published.get(store)!;
			const aggregate = body["aggregate"] as { total: number };
			body = { ...body, reviews: [...extra, ...(body["reviews"] as unknown[])], aggregate: { ...aggregate, total: aggregate.total + extra.length } };
		}

		if (request.method !== "GET" && found.response.status === 200) {
			for (const key of ["store", "store_id"]) {
				if (typeof body[key] === "string") {
					body = { ...body, [key]: store };
				}
			}
		}

		if (request.path === "/api/v1/orders" && found.response.status === 200) {
			const sent = (request.body as { orders: { id: string | number }[] }).orders;
			const [template] = body["results"] as Record<string, unknown>[];
			body = { ...body, results: sent.map((order) => ({ ...template, id: String(order.id) })) };
		}

		send(found.response.status, body);
	});
	await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : options.port;
	return {
		url: `http://127.0.0.1:${port}`,
		requests,
		close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
	};
}
