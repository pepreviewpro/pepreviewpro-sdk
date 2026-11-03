import { defineConfig } from "tsdown";
import { packageConfig } from "../../tsdown.shared.ts";

/** One output file per module, so each keeps its own `"use client"` and the primitives stay Server Components. */
export default defineConfig(packageConfig(import.meta.dirname, { platform: "neutral", unbundle: true, checks: { moduleLevelDirective: false } }));
