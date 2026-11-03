// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

describe("server only", () => {
	it("throws at import in a browser", async () => {
		await expect(import("../src/index")).rejects.toThrow(/server only/);
	});

	it("throws from the module bundlers pick for the browser", async () => {
		await expect(import("../src/browserGuard")).rejects.toThrow(/server only/);
	});
});
