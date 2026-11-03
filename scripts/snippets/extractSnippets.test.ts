import { describe, expect, it } from "vitest";
import { extractSnippets, PARTIAL_MARKER } from "./extractSnippets";

describe("extractSnippets", () => {
	it("takes ts and tsx blocks with their line numbers, and skips other languages", () => {
		const markdown = ["# Title", "", "```ts", "const a = 1;", "```", "", "```sh", "pnpm add x", "```", "", "```tsx", "<div />;", "```"].join("\n");
		expect(extractSnippets(markdown)).toEqual([
			{ line: 4, language: "ts", code: "const a = 1;" },
			{ line: 12, language: "tsx", code: "<div />;" }
		]);
	});

	it("leaves out a block marked partial, and only that block", () => {
		const markdown = [PARTIAL_MARKER, "", "```ts", "await prp.orders.upsert(order);", "```", "", "```ts", "const b = 2;", "```"].join("\n");
		expect(extractSnippets(markdown).map((snippet) => snippet.code)).toEqual(["const b = 2;"]);
	});

	it("strips a list item's indentation", () => {
		const markdown = ["1. Step", "", "   ```ts", "   const c = 3;", "   if (c) {", "   \tc;", "   }", "   ```"].join("\n");
		expect(extractSnippets(markdown)[0]?.code).toBe("const c = 3;\nif (c) {\n\tc;\n}");
	});
});
