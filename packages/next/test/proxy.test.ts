import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { describe, expect, it } from "vitest";
import { withPepReviewPro } from "../src/entries/proxy";

const event = {} as NextFetchEvent;

function landing(url: string, headers: Record<string, string> = {}) {
	return new NextRequest(url, { headers: { "sec-fetch-dest": "document", ...headers } });
}

const stored = (response: Response) => {
	const cookie = response.headers.get("set-cookie");
	return cookie ? (JSON.parse(decodeURIComponent(cookie.split(";")[0]!.split("=").slice(1).join("="))) as Record<string, unknown>) : null;
};

describe("withPepReviewPro", () => {
	it("records the first touch from the landing URL and an outside referrer, by the browser's rules", async () => {
		const response = await withPepReviewPro()(
			landing("https://store.example/p/bpc-157-10mg?prp_click_id=abc&utm_source=pepreviewpro#reviews", {
				referer: "https://pepreviewpro.com/stores/magnolia"
			}),
			event
		);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(response.headers.get("set-cookie")).toMatch(/^prp_attribution=[^;]+; Max-Age=2592000; Path=\/; SameSite=Lax; Secure$/);
		expect(stored(response)).toMatchObject({
			landing_url: "https://store.example/p/bpc-157-10mg?prp_click_id=abc&utm_source=pepreviewpro",
			referrer: "https://pepreviewpro.com/stores/magnolia",
			utm_source: "pepreviewpro",
			utm_medium: null
		});
	});

	it("uses the host and protocol the shopper asked for, not the address Next.js listens on", async () => {
		const proxy = withPepReviewPro();
		const behindProxy = await proxy(
			landing("http://localhost:3000/p?utm_source=x", { "x-forwarded-host": "store.example", "x-forwarded-proto": "https" }),
			event
		);
		expect(stored(behindProxy)).toMatchObject({ landing_url: "https://store.example/p?utm_source=x" });
		expect(behindProxy.headers.get("set-cookie")).toMatch(/; Secure$/);
		const ownPage = await proxy(landing("http://localhost:3000/cart", { host: "store.example", referer: "http://store.example/" }), event);
		expect(ownPage.headers.get("set-cookie")).toBeNull();
	});

	it("keeps the app's own proxy response and adds the cookie to it", async () => {
		const proxy = (request: NextRequest) => NextResponse.rewrite(new URL("/shop", request.url));
		const response = await withPepReviewPro(proxy, { cookieDomain: ".store.example" })(landing("http://store.example/?utm_source=newsletter"), event);
		expect(response.headers.get("x-middleware-rewrite")).toBe("http://store.example/shop");
		expect(response.headers.get("set-cookie")).toMatch(/; Domain=\.store\.example$/);
	});

	it("copies a redirect whose headers cannot change", async () => {
		const response = await withPepReviewPro(() => Response.redirect("https://store.example/home", 307))(
			landing("https://store.example/?utm_source=x"),
			event
		);
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://store.example/home");
		expect(stored(response)).toMatchObject({ utm_source: "x" });
	});

	it("records nothing for a visit that says nothing, an internal referrer, or a later page", async () => {
		const proxy = withPepReviewPro();
		const quiet = [
			landing("https://store.example/"),
			landing("https://store.example/cart", { referer: "https://store.example/" }),
			landing("https://store.example/?utm_source=x", { cookie: `prp_attribution=${encodeURIComponent(JSON.stringify({ utm_source: "first" }))}` })
		];
		for (const request of quiet) {
			expect((await proxy(request, event)).headers.get("set-cookie")).toBeNull();
		}
	});

	it("honours Global Privacy Control and consent, and skips prefetches and assets", async () => {
		const proxy = withPepReviewPro(undefined, { consent: (request) => request.cookies.get("consent")?.value === "yes" });
		const skipped = [
			landing("https://store.example/?utm_source=x", { "sec-gpc": "1", "cookie": "consent=yes" }),
			landing("https://store.example/?utm_source=x"),
			landing("https://store.example/?utm_source=x", { cookie: "consent=yes", rsc: "1" }),
			landing("https://store.example/logo.png?utm_source=x", { "cookie": "consent=yes", "sec-fetch-dest": "image" })
		];
		for (const request of skipped) {
			expect((await proxy(request, event)).headers.get("set-cookie")).toBeNull();
		}

		expect((await proxy(landing("https://store.example/?utm_source=x", { cookie: "consent=yes" }), event)).headers.get("set-cookie")).toMatch(
			/^prp_attribution=/
		);
	});
});
