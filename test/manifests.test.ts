import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPOSITORY_URL } from "../scripts/release/repository";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const packages = readdirSync(new URL("packages/", root));

describe.each(packages)("packages/%s", (name) => {
	const manifest = JSON.parse(read(`packages/${name}/package.json`)) as Record<string, unknown>;

	it("is proprietary, public on npm, and on Node 20 or later", () => {
		expect(manifest["name"]).toBe(`@pepreviewpro/${name}`);
		expect(manifest["license"]).toBe("SEE LICENSE IN LICENSE");
		expect(manifest["publishConfig"]).toEqual({ access: "public" });
		expect(manifest["engines"]).toEqual({ node: ">=20" });
		expect(manifest["files"]).toEqual(["dist", "AGENTS.md", "LICENSE", "README.md"]);
		expect(manifest).not.toHaveProperty("private");
	});

	it("names the public repository, a help article, and the support address", () => {
		expect(manifest["repository"]).toEqual({ type: "git", url: REPOSITORY_URL, directory: `packages/${name}` });
		expect(manifest["homepage"]).toMatch(/^https:\/\/pepreviewpro\.com\/help\/[a-z0-9-]+$/);
		expect(manifest["bugs"]).toEqual({ email: "support@pepreviewpro.com" });
	});

	it("ships the root license, a README that names the support address, and an agent guide", () => {
		expect(read(`packages/${name}/LICENSE`)).toBe(read("LICENSE"));
		expect(read(`packages/${name}/README.md`)).toContain("support@pepreviewpro.com");
		expect(read(`packages/${name}/AGENTS.md`)).toContain(`# @pepreviewpro/${name}`);
	});

	it("depends only on its siblings", () => {
		const dependencies = Object.keys((manifest["dependencies"] as Record<string, string> | undefined) ?? {});
		expect(dependencies.every((dependency) => dependency.startsWith("@pepreviewpro/"))).toBe(true);
	});
});
