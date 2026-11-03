import { ALLOWED_EXAMPLE_LABELS, ALLOWED_HOSTS, STORE_WORDS } from "./dataPolicy";

const PSEUDONYM_LABEL = new RegExp(`^(?:(?:${STORE_WORDS.join("|")})(?:-store)?|store-\\d+)$`);

/**
 * Whether a host may appear in the repository. `.example` hosts pass only with a generic or pseudonymous label, so
 * `<real store>.example` still fails.
 */
export function isAllowedHost(host: string): boolean {
	const name = host.toLowerCase().replace(/\.$/, "");
	if (name.endsWith(".example") || name === "example") {
		const labels = name.split(".").slice(0, -1);
		return labels.every((label) => ALLOWED_EXAMPLE_LABELS.includes(label) || PSEUDONYM_LABEL.test(label));
	}

	return ALLOWED_HOSTS.some((allowed) => (allowed.startsWith(".") ? name === allowed.slice(1) || name.endsWith(allowed) : name === allowed));
}
