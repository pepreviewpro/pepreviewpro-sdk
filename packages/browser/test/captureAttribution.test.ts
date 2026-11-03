// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ATTRIBUTION_COOKIE, captureAttribution, parseAttribution, readCheckoutContext } from "../src";
import { clearCookies, sendGlobalPrivacyControl, spyOnCookieWrites, visit } from "./dom";

afterEach(() => {
	clearCookies();
	visit("/");
});

const stored = () => readCheckoutContext().attribution;

describe("captureAttribution", () => {
	it("stores a landing with prp_click_id and its UTM tags", () => {
		visit(
			"/products/bpc-157-10mg?prp_click_id=abc123&utm_source=pepreviewpro&utm_medium=referral#reviews",
			"https://pepreviewpro.com/store/magnolia-store"
		);
		const attribution = captureAttribution();
		expect(attribution).toMatchObject({
			landing_url: "https://store.example/products/bpc-157-10mg?prp_click_id=abc123&utm_source=pepreviewpro&utm_medium=referral",
			referrer: "https://pepreviewpro.com/store/magnolia-store",
			utm_source: "pepreviewpro",
			utm_medium: "referral",
			utm_campaign: null,
			utm_content: null,
			utm_term: null
		});
		expect(Date.parse(attribution?.first_seen_at ?? "")).not.toBeNaN();
		expect(stored()).toEqual(attribution);
	});

	it("stores a UTM tag alone, and an outside referrer alone", () => {
		visit("/?utm_campaign=fall");
		expect(captureAttribution()?.utm_campaign).toBe("fall");
		clearCookies();
		visit("/", "https://search.example/");
		expect(captureAttribution()?.referrer).toBe("https://search.example/");
	});

	it("stores nothing for a visit with no signal or the store's own referrer", () => {
		visit("/products?page=2", "https://store.example/");
		expect(captureAttribution()).toBeNull();
		expect(document.cookie).not.toContain(ATTRIBUTION_COOKIE);
	});

	it("keeps the first touch over a later one", () => {
		visit("/?prp_click_id=first");
		const first = captureAttribution();
		visit("/?utm_source=newsletter", "https://mail.example/");
		expect(captureAttribution()).toEqual(first);
		expect(stored()?.landing_url).toContain("prp_click_id=first");
	});

	it("writes a 30-day, site-wide, Lax, Secure first-party cookie", () => {
		const writes = spyOnCookieWrites();
		visit("/?prp_click_id=abc");
		captureAttribution({ cookieDomain: ".store.example" });
		expect(writes).toHaveLength(1);
		expect(writes[0]).toMatch(/^prp_attribution=[^;]+; Max-Age=2592000; Path=\/; SameSite=Lax; Domain=\.store\.example; Secure$/);
	});

	it("cuts a long landing URL down to the tags that matter", () => {
		visit(`/p?junk=${"x".repeat(1200)}&prp_click_id=keep&utm_source=pepreviewpro`);
		const attribution = captureAttribution();
		expect(attribution?.landing_url).toBe("https://store.example/p?prp_click_id=keep&utm_source=pepreviewpro");
	});

	it("does nothing under Global Privacy Control", () => {
		sendGlobalPrivacyControl();
		visit("/?prp_click_id=abc");
		expect(captureAttribution({ consent: true })).toBeNull();
		expect(document.cookie).toBe("");
	});

	it("waits for consent", () => {
		visit("/?prp_click_id=abc");
		expect(captureAttribution({ consent: false })).toBeNull();
		expect(captureAttribution({ consent: () => false })).toBeNull();
		expect(document.cookie).toBe("");
		expect(captureAttribution({ consent: () => true })?.landing_url).toContain("abc");
	});
});

describe("parseAttribution", () => {
	it("keeps only known string fields and drops empty ones", () => {
		expect(parseAttribution(JSON.stringify({ utm_source: "x", evil: "<script>", utm_medium: 5, referrer: "" }))).toEqual({
			landing_url: null,
			referrer: null,
			utm_source: "x",
			utm_medium: null,
			utm_campaign: null,
			utm_content: null,
			utm_term: null,
			first_seen_at: null
		});
	});

	it("is null for anything that is not a captured touch", () => {
		expect(parseAttribution(null)).toBeNull();
		expect(parseAttribution("not json")).toBeNull();
		expect(parseAttribution("[1]")).toBeNull();
		expect(parseAttribution(JSON.stringify({ first_seen_at: "2026-11-01T00:00:00Z" }))).toBeNull();
	});
});
