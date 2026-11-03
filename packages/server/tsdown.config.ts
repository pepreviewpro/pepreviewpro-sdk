import { defineConfig } from "tsdown";
import { packageConfig } from "../../tsdown.shared.ts";

export default defineConfig(packageConfig(import.meta.dirname, { entry: ["src/index.ts", "src/browserGuard.ts"], platform: "neutral" }));
