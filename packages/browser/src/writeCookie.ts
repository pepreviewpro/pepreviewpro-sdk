import { serializeCookie } from "./serializeCookie";

/** A first-party, Lax cookie on the whole site, Secure on https. */
export function writeCookie(name: string, value: string, days: number, domain?: string): void {
	document.cookie = serializeCookie(name, value, { days, domain, secure: location.protocol === "https:" });
}
