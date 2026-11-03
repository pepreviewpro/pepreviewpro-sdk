import { vi } from "vitest";

/** Expires every cookie jsdom holds for the page. */
export function clearCookies(): void {
	for (const pair of document.cookie.split(";")) {
		const name = pair.split("=")[0]?.trim();
		if (name) {
			document.cookie = `${name}=; Max-Age=0; Path=/`;
			document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.store.example`;
		}
	}
}

export function visit(path: string, referrer = ""): void {
	window.history.replaceState({}, "", path);
	Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

export function sendGlobalPrivacyControl(): void {
	vi.stubGlobal("navigator", { userAgent: navigator.userAgent, globalPrivacyControl: true });
}

/** Every `document.cookie` write, attributes included, which reading the jar back cannot show. */
export function spyOnCookieWrites(): string[] {
	const writes: string[] = [];
	const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
	vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
		writes.push(value);
		descriptor?.set?.call(document, value);
	});
	return writes;
}
