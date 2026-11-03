import { isIPv4, isIPv6 } from "node:net";

/** Documentation ranges (RFC 5737, RFC 3849), loopback, and the unspecified address. Anything else could be real. */
export function isAllowedIp(address: string): boolean {
	if (isIPv4(address)) {
		const [a, b, c] = address.split(".").map(Number);
		return (
			a === 127 ||
			address === "0.0.0.0" ||
			(a === 192 && b === 0 && c === 2) ||
			(a === 198 && b === 51 && c === 100) ||
			(a === 203 && b === 0 && c === 113)
		);
	}

	if (isIPv6(address)) {
		const lower = address.toLowerCase();
		return lower === "::1" || lower === "::" || /^2001:0?db8(?::|$)/.test(lower);
	}

	return false;
}
