import { describe, expect, it } from "vitest";
import { findRealData } from "./findRealData";

// Built at runtime, so this file never holds the shapes it tests for.
const join = (...parts: string[]) => parts.join("");
const rules = (text: string) => findRealData(text).map((finding) => finding.rule);

describe("findRealData", () => {
	it("passes the fictional values the repository uses", () => {
		const text = [
			`fetch("https://pepreviewpro.com/api/v1/widget-data?site_id=example-store")`,
			`{ "store_id": "magnolia-store", "email": "buyer@example.com", "url": "https://store.example/p/sku-101" }`,
			`<div data-store="example-store"></div> "x-forwarded-for": "203.0.113.7, 2001:db8::1"`,
			`const key = fakeKey(); // sk_live_${"a".repeat(40)}`,
			"https://github.com/pepreviewpro/sdk and https://www.standardwebhooks.com"
		].join("\n");
		expect(findRealData(text)).toEqual([]);
	});

	it("finds emails, URLs, and domains outside the allowlist", () => {
		expect(rules(join("owner@", "real-store", ".com"))).toEqual(["email outside the allowlist"]);
		expect(rules(join("https://", "real-store", ".example/p/1"))).toEqual(["URL outside the allowlist"]);
		expect(rules(join("see ", "real-store", ".com for more"))).toEqual(["domain outside the allowlist"]);
		expect(rules(join("https://github.com/", "someone-else", "/repo"))).toEqual(["URL outside the allowlist"]);
	});

	it("finds IPs outside the documentation ranges, and not timestamps or versions", () => {
		expect(rules(join("ip: ", "10.1", ".2.3"))).toEqual(["IP outside the documentation ranges"]);
		expect(rules(join("ip: ", "2a00", ":1450::1"))).toEqual(["IP outside the documentation ranges"]);
		expect(rules("2026-10-03T14:21:07.512934+00:00 next@16.4.2 ::before")).toEqual([]);
	});

	it("finds keys and secrets, but not placeholders or the published test vectors", () => {
		expect(rules(join("sk_", "live_", "Ab3xQ9vR2mT8sLwYc1bNx7Uf4kP0eJ6h"))).toEqual(["API key"]);
		expect(rules(join("whsec_", "Zk2pQ9vR2mT8sLwYc1bNx7Uf"))).toEqual(["webhook secret"]);
		expect(rules(join("//registry.npmjs.org/:_auth", "Token=abc123"))).toEqual(["registry token"]);
		expect(rules(join("whsec_", "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"))).toEqual([]);
	});

	it("finds home directory paths", () => {
		expect(rules(join("/Us", "ers/someone/project"))).toEqual(["home directory path"]);
	});

	it("finds a store slug that is not a pseudonym, wherever a slug goes", () => {
		for (const text of [
			join(`{ "slug": "`, "real-store", `" }`),
			join(`new PepReviewPro({ store: "`, "real-store", `" })`),
			join(`?site_id=`, "real-store"),
			join("PEPREVIEWPRO_STORE=", "real-store"),
			join("https://pepreviewpro.com/store/", "real-store")
		]) {
			expect(rules(text)).toEqual(["store slug that is not a pseudonym"]);
		}
	});

	it("decodes base64 tokens", () => {
		const cursor = Buffer.from(join("owner@", "real-store", ".com")).toString("base64url");
		expect(rules(`next_cursor: "${cursor}"`)).toEqual(["email outside the allowlist, base64-encoded"]);
	});
});
