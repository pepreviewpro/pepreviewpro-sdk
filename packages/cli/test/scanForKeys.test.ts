import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeKey } from "../../../test/replay";
import { scanForKeys } from "../src/scanForKeys";
import { project } from "./helpers";

describe("scanForKeys", () => {
	it("finds a whole key in a client chunk, by file and line, without printing it", async () => {
		const dir = await project();
		await mkdir(join(dir, "chunks"));
		await writeFile(join(dir, "chunks", "app-3f1c.js"), `console.log(1);\nconst k="${fakeKey("pk", "Z")}";`);
		await writeFile(join(dir, "index.html"), `<p>Use your sk_live_… key</p>`);
		await mkdir(join(dir, "node_modules"));
		await writeFile(join(dir, "node_modules", "dep.js"), fakeKey("sk"));
		await writeFile(join(dir, "logo.png"), fakeKey("sk"));
		const findings = await scanForKeys(dir);
		expect(findings).toEqual([
			{ file: join("chunks", "app-3f1c.js"), line: 2, keyPrefix: "pk_live_ZZZZ", kind: "key" },
			{ file: "index.html", line: 1, keyPrefix: "sk_live_", kind: "prefix" }
		]);
		expect(JSON.stringify(findings)).not.toContain(fakeKey("pk", "Z"));
	});

	it("finds nothing in a clean build", async () => {
		const dir = await project({ "main.js": "export const store = 'magnolia-store';" });
		await expect(scanForKeys(dir)).resolves.toEqual([]);
	});
});
