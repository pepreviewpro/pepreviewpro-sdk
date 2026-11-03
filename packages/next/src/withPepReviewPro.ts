import {
	ATTRIBUTION_COOKIE,
	ATTRIBUTION_DAYS,
	attributionFromLanding,
	parseAttribution,
	serializeCookie,
	type Attribution
} from "@pepreviewpro/browser";
import { parseCookieHeader } from "@pepreviewpro/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

export type ProxyResult = Response | null | undefined | void;

/** A `proxy.ts` (Next.js 16) or `middleware.ts` (Next.js 15) function. */
export type ProxyFunction = (request: NextRequest, event: NextFetchEvent) => ProxyResult | Promise<ProxyResult>;

export interface AttributionProxyOptions {
	/** Whether the shopper agreed to tracking cookies. Global Privacy Control turns it off whatever this says. */
	consent?: ((request: NextRequest) => boolean) | undefined;
	/** Like `.example.com`, when checkout runs on another subdomain. */
	cookieDomain?: string | undefined;
}

/**
 * The URL the shopper asked for. Next.js builds `request.url` from the address it listens on, so behind a proxy or
 * `next start` its host is not the store's, and every referrer from the store's own pages would look external.
 */
function shopperUrl(request: NextRequest): URL {
	const url = new URL(request.url);
	const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim();
	const host = first("x-forwarded-host") || first("host");
	const protocol = first("x-forwarded-proto");
	if (host) {
		// Setting `host` without a port keeps the old one, so clear it first.
		url.port = "";
		url.host = host;
	}

	if (protocol === "http" || protocol === "https") {
		url.protocol = `${protocol}:`;
	}

	return url;
}

/** The first touch this request should record, or null: it is a page load, nobody opted out, and none is stored yet. */
function firstTouch(request: NextRequest, url: URL, options: AttributionProxyOptions): Attribution | null {
	const headers = request.headers;
	const pageLoad = request.method === "GET" && !headers.has("rsc") && (headers.get("sec-fetch-dest") ?? "document") === "document";
	if (!pageLoad || headers.get("sec-gpc")?.trim() === "1" || options.consent?.(request) === false) {
		return null;
	}

	if (parseAttribution(parseCookieHeader(headers.get("cookie")).get(ATTRIBUTION_COOKIE))) {
		return null;
	}

	return attributionFromLanding(url, headers.get("referer"));
}

/**
 * Wraps the app's proxy so the first page load records where the shopper came from in the `prp_attribution`
 * cookie, by the same rules as `captureAttribution` in the browser. A first visit that never runs JavaScript still
 * counts. With no proxy of your own, call it bare: `export const proxy = withPepReviewPro()`.
 */
export function withPepReviewPro(
	proxy?: ProxyFunction,
	options: AttributionProxyOptions = {}
): (request: NextRequest, event: NextFetchEvent) => Promise<Response> {
	return async (request, event) => {
		let response = (await proxy?.(request, event)) ?? NextResponse.next();
		const url = shopperUrl(request);
		const attribution = firstTouch(request, url, options);
		if (!attribution) {
			return response;
		}

		const cookie = serializeCookie(ATTRIBUTION_COOKIE, JSON.stringify(attribution), {
			days: ATTRIBUTION_DAYS,
			domain: options.cookieDomain,
			secure: url.protocol === "https:"
		});
		try {
			response.headers.append("set-cookie", cookie);
		} catch {
			// `Response.redirect()` and `Response.error()` have immutable headers, so the cookie goes on a copy.
			response = new Response(response.body, response);
			response.headers.append("set-cookie", cookie);
		}

		return response;
	};
}
