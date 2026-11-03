import { SERVER_ONLY_MESSAGE } from "./serverOnlyMessage";

/**
 * Throws in a browser. The `browser` export condition already swaps this package for a module that throws, so this
 * catches the bundlers and script tags that ignore conditions. Deno, Bun, workers, and edge runtimes have no
 * `window` and `document` together, so they pass.
 */
export function assertServerRuntime(): void {
	if (typeof window !== "undefined" && typeof document !== "undefined") {
		throw new Error(SERVER_ONLY_MESSAGE);
	}
}
