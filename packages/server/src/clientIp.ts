import { readHeader } from "./readHeader";
import type { HeadersLike } from "./types";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]+(:\d{1,3}(\.\d{1,3}){3})?$/i;

/** An address without the port or brackets a proxy may add, or null when it is not an IP address. */
function cleanAddress(raw: string | null | undefined): string | null {
	let address = raw?.trim().replace(/^"|"$/g, "");
	if (!address) {
		return null;
	}

	const bracketed = address.match(/^\[([^\]]+)\](?::\d+)?$/);
	if (bracketed?.[1]) {
		address = bracketed[1];
	} else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(address)) {
		address = address.slice(0, address.lastIndexOf(":"));
	}

	const v4 = address.match(IPV4);
	if (v4) {
		return v4.slice(1).every((part) => Number(part) <= 255) ? address : null;
	}

	return address.includes(":") && IPV6.test(address) ? address.toLowerCase() : null;
}

/**
 * The buyer's IP address from the request: the first hop of `X-Forwarded-For`, then `X-Real-IP`, then Cloudflare's
 * `CF-Connecting-IP`. The first hop is the client as the outermost proxy saw it.
 */
export function clientIp(headers: HeadersLike): string | null {
	return (
		cleanAddress(readHeader(headers, "x-forwarded-for")?.split(",")[0]) ??
		cleanAddress(readHeader(headers, "x-real-ip")) ??
		cleanAddress(readHeader(headers, "cf-connecting-ip"))
	);
}
