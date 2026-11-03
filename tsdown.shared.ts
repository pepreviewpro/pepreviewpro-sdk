import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UserConfig } from "tsdown";

/** The settings every package builds with: ESM, `.d.ts`, no source maps in the tarball, the version inlined. */
export function packageConfig(dir: string, overrides: UserConfig = {}): UserConfig {
	const { version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version: string };
	return {
		entry: ["src/index.ts"],
		format: "esm",
		dts: true,
		sourcemap: false,
		clean: true,
		target: "es2022",
		define: { __PACKAGE_VERSION__: JSON.stringify(version) },
		...overrides
	};
}
