import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The fixture format the app records its API contract tests in. */
export interface FixtureCase {
	name: string;
	request: { method: string; query: string; headers: Record<string, string>; body?: unknown };
	response: { status: number; headers: Record<string, string>; body: unknown; bodyText?: string; volatile?: string[] };
}

interface Fixture {
	endpoint: string;
	source: string;
	cases: FixtureCase[];
}

/** Each fixture's canonical path. App recordings are named for the endpoint; contract ones for the case they cover. */
const PATHS: Record<string, string> = {
	"get-widget-data": "/api/v1/widget-data",
	"widget-data-product-ref": "/api/v1/widget-data",
	"get-store-profile": "/api/v1/store-profile",
	"submit-review": "/api/v1/submit-review",
	"me": "/api/v1/me",
	"my-stores": "/api/v1/my-stores",
	"my-reviews": "/api/v1/my-reviews",
	"api-v1-my-orders": "/api/v1/my-orders",
	"orders": "/api/v1/orders",
	"catalog": "/api/v1/catalog",
	"heartbeat": "/api/v1/heartbeat",
	"stores": "/api/v1/stores",
	"products": "/api/v1/products",
	"reviews": "/api/v1/reviews",
	"vendor-miss": "/api/v1/vendor-miss",
	"partner-events": "/api/v1/partner-events"
};

const FIXTURES = join(import.meta.dirname, "fixtures");

/** Every fixture by name, for the replay server. */
export const FIXTURE_ENDPOINTS = Object.keys(PATHS);

/** Copies of the app's own contract recordings, else ones written from the wire contract. */
export function loadFixture(endpoint: string): Fixture & { path: string } {
	const path = PATHS[endpoint];
	if (!path) {
		throw new Error(`No path is known for fixture ${endpoint}.`);
	}

	for (const dir of ["api", "contract"]) {
		try {
			return { ...(JSON.parse(readFileSync(join(FIXTURES, dir, `${endpoint}.json`), "utf8")) as Fixture), path };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		}
	}

	throw new Error(`No fixture ${endpoint}.json`);
}

export function fixtureCase(endpoint: string, name: string): FixtureCase & { path: string } {
	const fixture = loadFixture(endpoint);
	const found = fixture.cases.find((item) => item.name === name);
	if (!found) {
		throw new Error(`Fixture ${endpoint} has no case "${name}". It has: ${fixture.cases.map((item) => item.name).join("; ")}`);
	}

	return { ...found, path: fixture.path };
}

/** The recorded response, as a fresh `Response` each time it is served. */
export function toResponse({ response }: FixtureCase): Response {
	const text = response.bodyText ?? (typeof response.body === "string" ? response.body : JSON.stringify(response.body));
	return new Response(text, { status: response.status, headers: response.headers });
}

export interface RecordedRequest {
	method: string;
	url: URL;
	headers: Headers;
	body: unknown;
}

type Reply = FixtureCase | Response | Error | ((request: RecordedRequest) => Response | Promise<Response>);

/**
 * A `fetch` that answers each call with the next reply in order, and records every request it gets. A reply is a
 * fixture case, a `Response`, an `Error` to throw like a failed connection, or a function. The last reply repeats.
 */
export function replayFetch(...replies: Reply[]): { fetch: typeof fetch; requests: RecordedRequest[] } {
	const requests: RecordedRequest[] = [];
	const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
		const text = typeof init?.body === "string" ? init.body : undefined;
		const recorded: RecordedRequest = {
			method: init?.method ?? "GET",
			url: new URL(String(input)),
			headers: new Headers(init?.headers),
			body: text === undefined ? undefined : (JSON.parse(text) as unknown)
		};
		const reply = replies[Math.min(requests.length, replies.length - 1)];
		requests.push(recorded);
		if (reply === undefined) {
			throw new Error("replayFetch has no replies.");
		}

		if (reply instanceof Error) {
			throw reply;
		}

		if (reply instanceof Response) {
			return reply.clone();
		}

		return typeof reply === "function" ? reply(recorded) : toResponse(reply);
	};

	return { fetch: fetchImpl as typeof fetch, requests };
}

/** A JSON `Response`, for replies no fixture covers, like a 503. */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/** A key in the real format, built at runtime so no key-shaped literal sits in the source. */
export function fakeKey(kind: "sk" | "pk" = "sk", fill = "a"): string {
	return `${kind}_live_${fill.repeat(40)}`;
}
