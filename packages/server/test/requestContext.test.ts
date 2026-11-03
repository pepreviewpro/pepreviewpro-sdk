import { describe, expect, it } from "vitest";
import { clientIp, parseCookieHeader, readRequestContext } from "../src";

const attribution = { landing_url: "https://store.example/?prp_click_id=abc", utm_source: "pepreviewpro" };
const cookie = `theme=dark; prp_attribution=${encodeURIComponent(JSON.stringify(attribution))}; prp_reviews_seen=1762092000`;

describe("clientIp", () => {
	it.each([
		[{ "x-forwarded-for": "203.0.113.7, 198.51.100.1, 198.51.100.2" }, "203.0.113.7"],
		[{ "x-forwarded-for": " 203.0.113.7:51234 " }, "203.0.113.7"],
		[{ "x-forwarded-for": "[2001:db8::1]:443" }, "2001:db8::1"],
		[{ "x-forwarded-for": "2001:DB8::1" }, "2001:db8::1"],
		[{ "x-forwarded-for": "unknown", "x-real-ip": "198.51.100.4" }, "198.51.100.4"],
		[{ "cf-connecting-ip": "198.51.100.9" }, "198.51.100.9"],
		[{ "x-forwarded-for": "999.1.1.1" }, null],
		[{}, null]
	])("reads %j as %s", (headers, ip) => {
		expect(clientIp(new Headers(headers))).toBe(ip);
	});

	it("reads Node-style headers, repeated ones by their first value", () => {
		expect(clientIp({ "X-Forwarded-For": ["203.0.113.7", "198.51.100.1"] })).toBe("203.0.113.7");
		expect(clientIp({ "x-real-ip": undefined, "x-forwarded-for": "203.0.113.8" })).toBe("203.0.113.8");
	});
});

describe("parseCookieHeader", () => {
	it("decodes values, strips quotes, and keeps the first of a repeated name", () => {
		const cookies = parseCookieHeader('a=1; b="two"; a=3; c=%E2%9C%93; bad=%E0%A4%A; =x; novalue');
		expect(Object.fromEntries(cookies)).toEqual({ a: "1", b: "two", c: "✓", bad: "%E0%A4%A" });
		expect(parseCookieHeader(null).size).toBe(0);
	});
});

describe("readRequestContext", () => {
	it("reads the cookies, IP, and user agent from a Fetch request", () => {
		const request = new Request("https://store.example/checkout", {
			headers: { "cookie": cookie, "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Macintosh)" }
		});
		expect(readRequestContext(request)).toEqual({
			attribution: expect.objectContaining(attribution),
			reviewsSeenAt: 1_762_092_000,
			ip: "203.0.113.7",
			userAgent: "Mozilla/5.0 (Macintosh)"
		});
	});

	it("reads nothing when the browser sends Global Privacy Control", () => {
		const request = { headers: { "cookie": cookie, "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0", "sec-gpc": "1" } };
		expect(readRequestContext(request)).toEqual({ attribution: null, reviewsSeenAt: null, ip: null, userAgent: null });
	});
});
