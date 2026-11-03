import { isIPv4, isIPv6 } from "node:net";
import { ALLOWED_GITHUB_OWNERS, PRODUCT_COMPOUNDS, PUBLIC_TEST_SECRETS } from "./dataPolicy";
import { isAllowedHost } from "./isAllowedHost";
import { isAllowedIp } from "./isAllowedIp";
import { isPseudonymSlug } from "./isPseudonymSlug";

export interface Finding {
	line: number;
	rule: string;
	match: string;
	/** The match cut short, so a public CI log never repeats what it found. */
	excerpt: string;
}

export interface FindOptions {
	/** Print whole matches instead of their first characters. For local runs only: CI logs of a public repo are public. */
	verbose?: boolean;
}

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g;
const URL_PATTERN = /\bhttps?:\/\/([^\s/?#"'`<>)\]},;\\]+)([^\s"'`<>)\]},;\\]*)/g;
const BARE_DOMAIN =
	/(?<![\w@./:-])((?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ai|us|uk|ca|de|au|biz|xyz|health|bio|example))(?![\w-])(?!\.[a-z])(\/[\w./-]*)?/g;
const IPV4 = /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g;
const IPV6 = /(?<![\w:.])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?![\w:.])/gi;
const HOME = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[A-Za-z0-9._-]+|~\/(?:git|code|src|projects|Developer)\//g;
const SECRETS: [rule: string, pattern: RegExp][] = [
	["API key", /\b(?:pk|sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
	["webhook secret", /\bwhsec_[A-Za-z0-9+/]{20,}={0,2}/g],
	["npm token", /\bnpm_[A-Za-z0-9]{36}\b/g],
	["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g],
	["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
	["AWS account", /arn:aws:[\w-]*:[\w-]*:\d{12}:/g],
	["AWS secret", /aws_secret_access_key\s*[=:]\s*\S{20,}/gi],
	["JWT", /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g],
	["registry token", /_authToken\s*=\s*(?!\$\{)\S+/g],
	["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
	["Anthropic key", /\bsk-ant-[\w-]{20,}/g],
	["Slack token", /\bxox[abpr]-[\w-]{10,}/g]
];

/** Places a store slug sits: a JSON or object field, a JSX prop, an env line, a query param, or a store page URL. */
const STORE_SLOTS = [
	/["']?\b(?:slug|store_id|site_id|requested_site_id|vendor_key|x-store-scope|store|storeId|siteId|STORE|PEPREVIEWPRO_STORE)["']?\s*[:=]\s*\{?\s*["'`]([^"'`$\s{}]*)["'`]/g,
	/\bdata-(?:store|site-id)=["']([^"']*)["']/g,
	/\bPEPREVIEWPRO_STORE=([^\s"'#]+)/g,
	/[?&](?:site_id|store_id)=([^&#"'`\s)]+)/g,
	/pepreviewpro\.com\/store\/([\w-]+)/g,
	/pepreviewpro:([a-z0-9-]+)(?=["':])/g
];
const BASE64 = /[A-Za-z0-9+/_-]{16,}={0,2}/g;
/** The `filters` echo names its compound by `slug`, so the six fictional compounds' slugs are not store slugs. */
const COMPOUND_SLUGS = new Set(PRODUCT_COMPOUNDS.map((compound) => compound.toLowerCase()));

/** Keys built for tests from one repeated character, like `sk_live_aaaa…`, are placeholders. */
function isPlaceholderSecret(value: string): boolean {
	const body = value.replace(/^[a-z]+_(?:live_|test_)?/, "");
	return new Set(body).size <= 3 || /(.)\1{11}/.test(body);
}

function excerpt(text: string): string {
	return text.length <= 6 ? `${text.slice(0, 2)}…` : `${text.slice(0, 6)}…`;
}

function decodeBase64(token: string): string | null {
	const text = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
	return /^[\u0020-\u007e\t\n]+$/.test(text) && /[A-Za-z]{3}/.test(text) ? text : null;
}

function isAllowedUrl(host: string, path: string): boolean {
	const name = host
		.replace(/:\d+$/, "")
		.replace(/^\[|\]$/g, "")
		.toLowerCase();
	if (/[$<>{}]/.test(name) || !name.includes(".")) {
		return !(isIPv6(name) && !isAllowedIp(name));
	}

	if (isIPv4(name) || isIPv6(name)) {
		return isAllowedIp(name);
	}

	if (name === "github.com" || name === "www.github.com" || name === "raw.githubusercontent.com") {
		const owner = path.split("/")[1]?.toLowerCase() ?? "";
		return owner === "" || ALLOWED_GITHUB_OWNERS.includes(owner);
	}

	return isAllowedHost(name);
}

function scanLine(text: string, report: (rule: string, match: string) => void, slugs: boolean): void {
	let rest = text;
	rest = rest.replace(URL_PATTERN, (match, host: string, path: string) => {
		if (!isAllowedUrl(host, path)) {
			report("URL outside the allowlist", match);
		}

		return " ".repeat(match.length);
	});
	rest = rest.replace(EMAIL, (match, domain: string) => {
		if (!isAllowedHost(domain)) {
			report("email outside the allowlist", match);
		}

		return " ".repeat(match.length);
	});
	for (const match of rest.matchAll(BARE_DOMAIN)) {
		if (!isAllowedUrl(match[1] ?? "", match[2] ?? "")) {
			report("domain outside the allowlist", match[0]);
		}
	}

	for (const match of rest.matchAll(IPV4)) {
		if (isIPv4(match[0]) && !isAllowedIp(match[0])) {
			report("IP outside the documentation ranges", match[0]);
		}
	}

	for (const match of rest.matchAll(IPV6)) {
		if (isIPv6(match[0]) && !isAllowedIp(match[0])) {
			report("IP outside the documentation ranges", match[0]);
		}
	}

	for (const [rule, pattern] of SECRETS) {
		for (const match of text.matchAll(pattern)) {
			if (!PUBLIC_TEST_SECRETS.includes(match[0]) && !isPlaceholderSecret(match[0])) {
				report(rule, match[0]);
			}
		}
	}

	for (const match of text.matchAll(HOME)) {
		report("home directory path", match[0]);
	}

	if (!slugs) {
		return;
	}

	for (const pattern of STORE_SLOTS) {
		for (const match of text.matchAll(pattern)) {
			const value = match[1] ?? "";
			if (/^[A-Za-z0-9][\w-]*$/.test(value) && !/^[A-Z0-9_]+$/.test(value) && !isPseudonymSlug(value) && !COMPOUND_SLUGS.has(value.toLowerCase())) {
				report("store slug that is not a pseudonym", value);
			}
		}
	}
}

/**
 * Finds anything in a file that could be real: emails, URLs, and domains outside the allowlist, IPs outside the
 * documentation ranges, key and secret shapes, home directory paths, and store slugs that are not pseudonyms. Base64
 * tokens are decoded and checked too, since a cursor can carry an email.
 */
export function findRealData(content: string, options: FindOptions = {}): Finding[] {
	const findings: Finding[] = [];
	content.split("\n").forEach((text, index) => {
		const report = (rule: string, match: string) => findings.push({ line: index + 1, rule, match, excerpt: options.verbose ? match : excerpt(match) });
		scanLine(text, report, true);
		for (const match of text.matchAll(BASE64)) {
			const decoded = decodeBase64(match[0]);
			if (decoded !== null) {
				scanLine(decoded, (rule, found) => report(`${rule}, base64-encoded`, found), false);
			}
		}
	});
	return findings;
}
