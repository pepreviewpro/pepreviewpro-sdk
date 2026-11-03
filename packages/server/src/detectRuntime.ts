type RuntimeGlobals = {
	Deno?: { version?: { deno?: string } };
	Bun?: { version?: string };
	EdgeRuntime?: string;
	process?: { versions?: { node?: string } };
	navigator?: { userAgent?: string };
};

/** Like `node@22.11.0`, `bun@1.2.0`, `deno@2.1.0`, `edge-runtime`, or `workerd`, for the heartbeat. */
export function detectRuntime(): string {
	const runtime = globalThis as RuntimeGlobals;
	if (runtime.Deno?.version?.deno) {
		return `deno@${runtime.Deno.version.deno}`;
	}

	if (runtime.Bun?.version) {
		return `bun@${runtime.Bun.version}`;
	}

	if (typeof runtime.EdgeRuntime === "string") {
		return runtime.EdgeRuntime;
	}

	if (runtime.process?.versions?.node) {
		return `node@${runtime.process.versions.node}`;
	}

	return runtime.navigator?.userAgent === "Cloudflare-Workers" ? "workerd" : "unknown";
}
