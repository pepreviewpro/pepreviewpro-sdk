import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
	// The SDK's packages are linked from this repository, above the app.
	turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) }
};

export default nextConfig;
