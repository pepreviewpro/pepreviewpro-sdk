// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseReviewsSeen, readCheckoutContext, REVIEWS_SEEN_COOKIE, trackReviewsSeen } from "../src";
import { clearCookies, sendGlobalPrivacyControl, spyOnCookieWrites } from "./dom";

let observers: FakeObserver[] = [];

class FakeObserver {
	disconnected = false;
	readonly options: IntersectionObserverInit | undefined;
	readonly #callback: IntersectionObserverCallback;

	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.#callback = callback;
		this.options = options;
		observers.push(this);
	}

	observe() {}

	disconnect() {
		this.disconnected = true;
	}

	show(ratio: number, size = 100) {
		const entry = { isIntersecting: ratio > 0, intersectionRatio: ratio, boundingClientRect: { width: size, height: size } };
		this.#callback([entry as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
	}
}

beforeEach(() => {
	observers = [];
	vi.stubGlobal("IntersectionObserver", FakeObserver);
	vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-11-02T16:00:00Z") });
});

afterEach(() => {
	vi.useRealTimers();
	clearCookies();
});

describe("trackReviewsSeen", () => {
	it("marks the reviews seen once half the element is on screen", () => {
		trackReviewsSeen(document.createElement("div"));
		const [observer] = observers;
		expect(observer?.options).toEqual({ threshold: 0.5 });
		observer?.show(0.4);
		expect(document.cookie).not.toContain(REVIEWS_SEEN_COOKIE);
		observer?.show(0.6);
		expect(readCheckoutContext().reviews_seen_at).toBe(1_793_635_200);
		expect(observer?.disconnected).toBe(true);
	});

	it("keeps the mark for 7 days", () => {
		const writes = spyOnCookieWrites();
		trackReviewsSeen(document.createElement("div"));
		observers[0]?.show(1);
		expect(writes[0]).toBe("prp_reviews_seen=1793635200; Max-Age=604800; Path=/; SameSite=Lax; Secure");
	});

	it("ignores an element with no box", () => {
		trackReviewsSeen(document.createElement("div"));
		observers[0]?.show(1, 0);
		expect(document.cookie).toBe("");
	});

	it("stops when told to", () => {
		const stop = trackReviewsSeen(document.createElement("div"));
		stop();
		expect(observers[0]?.disconnected).toBe(true);
	});

	it("never watches under Global Privacy Control or without consent", () => {
		trackReviewsSeen(document.createElement("div"), { consent: false });
		sendGlobalPrivacyControl();
		trackReviewsSeen(document.createElement("div"));
		expect(observers).toHaveLength(0);
	});

	it("asks for consent again when the mark would be written", () => {
		let consent = true;
		trackReviewsSeen(document.createElement("div"), { consent: () => consent });
		consent = false;
		observers[0]?.show(1);
		expect(document.cookie).toBe("");
	});
});

describe("readCheckoutContext", () => {
	it("reads both cookies the server would", () => {
		document.cookie = `prp_attribution=${encodeURIComponent(JSON.stringify({ landing_url: "https://store.example/?prp_click_id=abc" }))}; Path=/`;
		document.cookie = "prp_reviews_seen=1762092000; Path=/";
		expect(readCheckoutContext()).toEqual({
			attribution: expect.objectContaining({ landing_url: "https://store.example/?prp_click_id=abc" }),
			reviews_seen_at: 1_762_092_000
		});
	});

	it("is empty under Global Privacy Control", () => {
		document.cookie = "prp_reviews_seen=1762092000; Path=/";
		sendGlobalPrivacyControl();
		expect(readCheckoutContext()).toEqual({ attribution: null, reviews_seen_at: null });
	});
});

describe("parseReviewsSeen", () => {
	const now = Date.parse("2026-11-02T16:00:00Z");

	it.each([
		["1762092000", 1_762_092_000],
		["abc", null],
		["1762092000.5", null],
		["12", null],
		[String(now / 1000 + 2 * 86_400), null],
		[undefined, null]
	])("reads %j as %j", (raw, expected) => {
		expect(parseReviewsSeen(raw, now)).toBe(expected);
	});
});
