export interface CookieOptions {
	days: number;
	domain?: string | undefined;
	secure: boolean;
}

/** A first-party, Lax cookie on the whole site, as `document.cookie` takes it and a `Set-Cookie` header sends it. */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
	const scope = options.domain ? `; Domain=${options.domain}` : "";
	return `${name}=${encodeURIComponent(value)}; Max-Age=${options.days * 86_400}; Path=/; SameSite=Lax${scope}${options.secure ? "; Secure" : ""}`;
}
