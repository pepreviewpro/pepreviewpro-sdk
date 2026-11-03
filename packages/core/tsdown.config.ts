import { defineConfig } from "tsdown";
import { packageConfig } from "../../tsdown.shared.ts";

export default defineConfig(packageConfig(import.meta.dirname, { platform: "neutral" }));
