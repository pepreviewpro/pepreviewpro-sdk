import { createHash } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import {
	ACCENTED_PERSON_WORDS,
	GENERIC_PATH_WORDS,
	GENERIC_UTM_VALUES,
	PATH_WORDS,
	PERSON_WORDS,
	PRODUCT_COMPOUNDS,
	PRODUCT_FORM_WORDS,
	SENTINEL_SLUGS,
	STORE_WORDS,
	UNIT_WORDS
} from "./dataPolicy";
import { isAllowedHost } from "./isAllowedHost";
import { isAllowedIp } from "./isAllowedIp";
import { isPseudonymSlug } from "./isPseudonymSlug";

export interface AnonymizeOptions {
	/**
	 * Extra `real → fictional` replacements for prose no field names, like a partner in an endpoint summary. They
	 * come from a file outside the repository, because committing them would publish them.
	 */
	terms?: Record<string, string>;
}

type Kind = "store" | "product" | "order" | "person" | null;

interface Context {
	key: string;
	kind: Kind;
	/** The slug of the store object this value sits in, so its site URL maps to the same pseudonym. */
	store: string | null;
}

const STORE_KEYS = new Set(["slug", "store_id", "site_id", "requested_site_id", "vendor_key", "x-store-scope", "store", "store_slug"]);
const PRODUCT_REF_KEYS = new Set(["product_id", "product_ref", "ref", "sku", "variation_id"]);
const ORDER_KEYS = new Set(["order_id", "order_ref", "client_reference_id", "numeric_id"]);
const PERSON_KEYS = new Set(["reviewer_name", "author", "customer_name", "buyer_name", "first_name", "last_name", "author_name"]);
const STORE_PARENTS = new Set(["stores", "vendors", "store"]);
const PRODUCT_PARENTS = new Set(["products", "line_items", "matched_products", "product", "items"]);
const ORDER_PARENTS = new Set(["orders", "order", "results"]);
const PERSON_PARENTS = new Set(["contacts", "customer", "buyer", "reviewer"]);
const VENDOR_MISS_KEYS = new Set(["name", "url", "question"]);
/** A store name made only of these, like "Olive Store", is already a pseudonym. */
const PSEUDONYM_NAME_WORDS = new Set(["example", "store", ...STORE_WORDS]);

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EXACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYNTHETIC_UUID = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/i;
const URL_PATTERN = /https?:\/\/[^\s"'<>`)\]]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const IPV4 = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;
const IPV6 = /(?<![\w:])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?![\w:])/gi;
const KEY = /\b((?:pk|sk)_(?:live|test)_)([A-Za-z0-9]{16,})/g;
const BASE64 = /^[A-Za-z0-9+/_-]{12,}={0,2}$/;
const WORD = /&#?\w+;|\p{L}{2,}/gu;
const SLUG_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/** `/products` takes `store` as a comma-separated list of slugs. */
const SLUG_LIST = /^[A-Za-z0-9][A-Za-z0-9_-]*(\s*,\s*[A-Za-z0-9][A-Za-z0-9_-]*)+$/;
const NUMERIC = /^\d+$/;

function hashIndex(value: string, size: number): number {
	return createHash("sha256").update(value).digest().readUInt32BE(0) % size;
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Gives `replacement` the casing of `original`, word by word: `corner Shop` makes `maple Store`. */
function matchCase(original: string, replacement: string): string {
	const sourceWords = original.split(/[\s_-]+/).filter(Boolean);
	let index = 0;
	return replacement.replace(/\p{L}[\p{L}\p{N}]*/gu, (word) => {
		const source = sourceWords[Math.min(index++, sourceWords.length - 1)] ?? "";
		if (source.length > 1 && source === source.toUpperCase() && /\p{L}/u.test(source)) {
			return word.toUpperCase();
		}

		if (source === source.toLowerCase()) {
			return word.toLowerCase();
		}

		return capitalize(word.toLowerCase());
	});
}

/** Replaces every word with a fictional one chosen by its hash, and keeps spacing, punctuation, digits, and entities. */
function pseudonymizeWords(text: string, words: string[], keep: string[] = []): string {
	const kept = new Set([...words, ...ACCENTED_PERSON_WORDS, ...keep].map((word) => word.toLowerCase()));
	return text.replace(WORD, (word, offset: number) => {
		const lower = word.toLowerCase();
		if (word.startsWith("&") || kept.has(lower) || (UNIT_WORDS.includes(lower) && /\d/.test(text.charAt(offset - 1)))) {
			return word;
		}

		const pool = /[^\u0000-\u007f]/.test(word) ? ACCENTED_PERSON_WORDS : words;
		return matchCase(word, pool[hashIndex(lower, pool.length)] ?? word);
	});
}

const UNITS = UNIT_WORDS.join("|");
const COMPOUND_SOURCE = PRODUCT_COMPOUNDS.map((compound) => compound.replace(/-/g, "[-\\s]?")).join("|");
const COMPOUND = new RegExp(`^(?:${COMPOUND_SOURCE})$`, "iu");
const DOSE = new RegExp(`^\\d+(?:\\.\\d+)?(?:\\s?(?:${UNITS}))?$`, "iu");
/** An entity, one of the six compounds however it is spelled, a dose, or any other word, hyphenated parts included. */
const PRODUCT_TOKEN = new RegExp(
	`&#?\\w+;|(?<![\\p{L}\\p{N}])(?:${COMPOUND_SOURCE})(?![\\p{L}\\p{N}])|\\d+(?:\\.\\d+)?(?:\\s?(?:${UNITS}))?(?![\\p{L}\\p{N}])|[\\p{L}\\p{N}]+(?:-[\\p{L}\\p{N}]+)*`,
	"giu"
);
/** The words of the six compounds, kept in a path segment outside a product. */
const COMPOUND_WORDS = PRODUCT_COMPOUNDS.flatMap((compound) => compound.toLowerCase().split("-"));

function canonicalCompound(text: string): string | undefined {
	const bare = text.toLowerCase().replace(/[-\s]/g, "");
	return PRODUCT_COMPOUNDS.find((compound) => compound.toLowerCase().replace(/-/g, "") === bare);
}

/**
 * Renames a product after the six compounds of `PRODUCT_COMPOUNDS`: a compound among them, a dose, and a form word
 * stay; any other run of words becomes one of the six, chosen by its hash so "Widget 10mg" and `widget-10mg` agree,
 * or is dropped when it only qualifies a compound beside it, like a store's own code. With `slug`, reads and writes
 * a URL path segment.
 */
function pseudonymizeProduct(text: string, slug = false): string {
	const source = slug ? text.replace(/-/g, " ") : text;
	const kept = new Set([...PRODUCT_FORM_WORDS, ...UNIT_WORDS, ...(slug ? GENERIC_PATH_WORDS : [])].map((word) => word.toLowerCase()));
	const tokens = [...source.matchAll(PRODUCT_TOKEN)].map((match) => {
		const value = match[0];
		const compound = COMPOUND.test(value) ? canonicalCompound(value) : undefined;
		const keep = value.startsWith("&") || DOSE.test(value) || kept.has(value.toLowerCase());
		return { value, start: match.index, end: match.index + value.length, compound, unknown: !compound && !keep };
	});
	const gap = (index: number) => source.slice(index === 0 ? 0 : (tokens[index - 1]?.end ?? 0), tokens[index]?.start ?? source.length);
	const adjacent = (index: number) => /^[\s-]*$/.test(gap(index));
	if (slug) {
		// A slug splits `widget-500` in two, so a bare number after an unknown word stays with it, as it would in a name.
		tokens.forEach((token, index) => {
			if (/^\d+$/.test(token.value) && index > 0 && tokens[index - 1]?.unknown && adjacent(index)) {
				token.unknown = true;
			}
		});
	}

	const present = new Set(tokens.flatMap((token) => (token.compound ? [token.compound] : [])));
	const out = tokens.map((token) => token.compound ?? token.value);
	const gaps = tokens.map((_token, index) => gap(index));
	for (let first = 0; first < tokens.length; first++) {
		if (!tokens[first]?.unknown) {
			continue;
		}

		let last = first;
		while (tokens[last + 1]?.unknown && adjacent(last + 1)) {
			last++;
		}

		for (let index = first + 1; index <= last; index++) {
			out[index] = "";
			gaps[index] = "";
		}

		const before = tokens[first - 1]?.compound && adjacent(first);
		const after = tokens[last + 1]?.compound && adjacent(last + 1);
		if (before || after) {
			out[first] = "";
			gaps[after ? last + 1 : first] = "";
		} else {
			const run = source
				.slice(tokens[first]?.start, tokens[last]?.end)
				.replace(/[\s-]+/g, " ")
				.toLowerCase();
			const start = hashIndex(run, PRODUCT_COMPOUNDS.length);
			const pick = PRODUCT_COMPOUNDS.map((_compound, offset) => PRODUCT_COMPOUNDS[(start + offset) % PRODUCT_COMPOUNDS.length] ?? "Semax");
			const compound = pick.find((candidate) => !present.has(candidate)) ?? pick[0] ?? "Semax";
			present.add(compound);
			out[first] = compound;
		}

		first = last;
	}

	const joined = `${tokens.map((_token, index) => `${gaps[index] ?? ""}${out[index] ?? ""}`).join("")}${source.slice(tokens.at(-1)?.end ?? 0)}`;
	const tidy = joined.replace(/\s{2,}/g, " ").trim();
	return slug ? tidy.toLowerCase().replace(/\s+/g, "-") : tidy;
}

function decodeBase64(value: string): string | null {
	if (!BASE64.test(value) || NUMERIC.test(value)) {
		return null;
	}

	const text = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
	const readable = /^[\u0020-\u007e\u00a0-\uffff\t\n]+$/.test(text) && !text.includes("\ufffd");
	return readable && (/^\s*[[{]/.test(text) || text.includes("@")) ? text : null;
}

function encodeBase64Like(original: string, text: string): string {
	const standard = Buffer.from(text, "utf8").toString("base64");
	const urlSafe = /[-_]/.test(original) || !/[+/]/.test(original);
	const encoded = urlSafe ? standard.replace(/\+/g, "-").replace(/\//g, "_") : standard;
	return original.endsWith("=") ? encoded : encoded.replace(/=+$/, "");
}

/** Values seen in the first pass, given pseudonyms once every value is known. */
class Registry<T extends string | number> {
	readonly seen: T[] = [];
	readonly reserved = new Set<string>();
	readonly map = new Map<string, T>();

	see(value: T): void {
		if (!this.seen.some((item) => keyOf(item) === keyOf(value))) {
			this.seen.push(value);
		}
	}

	get(value: T): T | undefined {
		return this.map.get(keyOf(value));
	}
}

function keyOf(value: string | number): string {
	return typeof value === "number" ? `#${value}` : value.toLowerCase();
}

/** Picks the first pseudonym from `candidates(n)` that nothing else holds. */
function claim(taken: Set<string>, candidates: (attempt: number) => string): string {
	for (let attempt = 0; ; attempt++) {
		const candidate = candidates(attempt);
		if (!taken.has(candidate.toLowerCase())) {
			taken.add(candidate.toLowerCase());
			return candidate;
		}
	}
}

/**
 * Rewrites the app's recordings so they hold no real data, and the same input always comes out the same. Stores,
 * people, products, orders, hosts, emails, IPs, UUIDs, and keys are found by the field they sit in, then replaced
 * everywhere they appear, including inside URLs, query strings, and base64 cursors. Values already in the fictional
 * shapes of `dataPolicy.ts` are kept, so running it again changes nothing. The first store becomes `example-store`;
 * the rest are named by a hash of their slug, so adding a store does not rename the others.
 */
export function anonymizeFixtures(documents: unknown[], options: AnonymizeOptions = {}): unknown[] {
	const stores = new Registry<string>();
	const storeNames = new Map<string, string | null>();
	const hosts = new Map<string, string | null>();
	const products = new Registry<string>();
	const orders = new Registry<string | number>();
	const uuids = new Registry<string>();
	const prefixes = new Registry<string>();
	const partners = new Registry<string>();
	const tokens = new Map<string, string>(Object.entries(options.terms ?? {}).map(([real, fake]) => [real.toLowerCase(), fake]));
	let collecting = true;

	const storeOf = (value: string): string => stores.get(value) ?? value;

	function slugValue(value: string): string {
		if (EXACT_UUID.test(value) || !SLUG_SHAPE.test(value) || isPseudonymSlug(value)) {
			if (collecting && isPseudonymSlug(value)) {
				stores.see(value);
			}

			return uuidsIn(value);
		}

		if (collecting) {
			stores.see(value);
			return value;
		}

		return matchCase(value, storeOf(value));
	}

	function uuidsIn(text: string): string {
		return text.replace(UUID, (uuid) => {
			if (SYNTHETIC_UUID.test(uuid)) {
				uuids.reserved.add(uuid.toLowerCase());
				return uuid;
			}

			if (collecting) {
				uuids.see(uuid.toLowerCase());
				return uuid;
			}

			return uuids.get(uuid) ?? uuid;
		});
	}

	function productRef(value: string): string {
		if (EXACT_UUID.test(value)) {
			return uuidsIn(value);
		}

		if (NUMERIC.test(value) || /^sku-\d+$/.test(value)) {
			products.reserved.add(value);
			return value;
		}

		if (collecting) {
			products.see(value);
			return value;
		}

		return products.get(value) ?? value;
	}

	function orderRef(value: string | number): string | number {
		const numeric = typeof value === "number" ? value : NUMERIC.test(value) ? Number(value) : null;
		if (numeric !== null && (!Number.isInteger(numeric) || numeric < 100 || numeric >= 1e12)) {
			return value;
		}

		if ((numeric !== null && numeric > 1000 && numeric < 2000) || (typeof value === "string" && /^ORD-\d+$/.test(value))) {
			orders.reserved.add(keyOf(numeric ?? value));
			return value;
		}

		if (typeof value === "string" && EXACT_UUID.test(value)) {
			return uuidsIn(value);
		}

		if (typeof value === "string" && value.length < 3) {
			return value;
		}

		const entry = numeric ?? value;
		if (collecting) {
			orders.see(entry);
			return value;
		}

		const mapped = orders.get(entry);
		if (mapped === undefined) {
			return value;
		}

		return typeof value === "string" && typeof mapped === "number" ? String(mapped) : mapped;
	}

	function host(name: string, store: string | null): string {
		const lower = name.toLowerCase();
		if (isAllowedHost(lower)) {
			return name;
		}

		if (collecting) {
			if (!hosts.has(lower) || (store && !hosts.get(lower))) {
				hosts.set(lower, store);
			}

			return name;
		}

		return hosts.get(lower) ?? name;
	}

	function pathSegment(segment: string, pseudonymize: boolean, product: boolean): string {
		const base64 = decodeBase64(segment.split(".")[0] ?? "");
		if (base64 !== null) {
			const [head, ...rest] = segment.split(".");
			return [encodedValue(head ?? "", base64, "segment"), ...rest].join(".");
		}

		const mapped = uuidsIn(segment);
		if (mapped !== segment || !pseudonymize || /^[0-9a-f]+(?:\.\w+)?$/i.test(segment)) {
			return mapped;
		}

		const known = collecting ? undefined : (stores.get(segment) ?? products.get(segment));
		if (known !== undefined) {
			return known;
		}

		return product
			? pseudonymizeProduct(segment, true)
			: pseudonymizeWords(segment, PATH_WORDS, [...GENERIC_PATH_WORDS, ...COMPOUND_WORDS]).toLowerCase();
	}

	function queryString(query: string, store: string | null): string {
		return query
			.split("&")
			.map((pair) => {
				const [rawKey = "", ...rest] = pair.split("=");
				if (rest.length === 0) {
					return pair;
				}

				const raw = rest.join("=");
				let decoded: string;
				try {
					decoded = decodeURIComponent(raw.replace(/\+/g, " "));
				} catch {
					return pair;
				}

				const next = transformString(decoded, { key: decodeURIComponent(rawKey), kind: null, store });
				return next === decoded ? pair : `${rawKey}=${encodeURIComponent(next)}`;
			})
			.join("&");
	}

	function url(text: string, store: string | null, product: boolean): string {
		const match = /^(https?:\/\/)([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(text);
		if (!match) {
			return text;
		}

		const [, scheme = "", authority = "", path = "", query = "", hash = ""] = match;
		const [hostname = "", port] = authority.split(":");
		const mappedHost = host(hostname, store);
		const ours = /(^|\.)pepreviewpro\.com$/i.test(hostname) && !/^cdn\./i.test(hostname);
		const mappedPath = path
			.split("/")
			.map((segment) => (segment ? pathSegment(segment, !ours, product) : segment))
			.join("/");
		const mappedQuery = query ? `?${queryString(query.slice(1), store)}` : "";
		return `${scheme}${mappedHost}${port === undefined ? "" : `:${port}`}${mappedPath}${mappedQuery}${hash}`;
	}

	function encodedValue(original: string, decoded: string, key: string): string {
		let inner: string;
		try {
			inner = JSON.stringify(walk(JSON.parse(decoded) as unknown, { key, kind: null, store: null }));
		} catch {
			inner = transformString(decoded, { key, kind: null, store: null });
		}

		return inner === decoded || collecting ? original : encodeBase64Like(original, inner);
	}

	function generic(text: string, store: string | null, product = false): string {
		let out = text.replace(URL_PATTERN, (found) => url(found, store, product));
		out = out.replace(EMAIL, (email, domain: string) => {
			if (isAllowedHost(domain)) {
				return email;
			}

			return `buyer-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 6)}@example.com`;
		});
		out = uuidsIn(out);
		out = out.replace(IPV4, (ip) => (!isIPv4(ip) || isAllowedIp(ip) ? ip : `203.0.113.${(hashIndex(ip, 254) + 1).toString()}`));
		out = out.replace(IPV6, (ip) => (!isIPv6(ip) || isAllowedIp(ip) ? ip : `2001:db8::${(hashIndex(ip, 0xfffe) + 1).toString(16)}`));
		out = out.replace(KEY, (_key, prefix: string, body: string) => `${prefix}${"0".repeat(body.length)}`);
		if (/^[0-9a-f]{8}$/i.test(out) && !collecting) {
			const full = uuids.seen.find((uuid) => uuid.startsWith(out.toLowerCase()));
			if (full) {
				return (uuids.get(full) ?? full).slice(0, 8);
			}
		}

		if (!collecting && tokenPattern) {
			out = out.replace(tokenPattern, (found) => matchCase(found, tokens.get(found.toLowerCase()) ?? found));
		}

		return out;
	}

	function transformString(value: string, context: Context): string {
		const { key, kind } = context;
		const lowerKey = key.toLowerCase();
		const decoded = decodeBase64(value);
		if (decoded !== null) {
			return encodedValue(value, decoded, key);
		}

		if (lowerKey === "query") {
			return queryString(value, context.store);
		}

		if (STORE_KEYS.has(lowerKey) || (kind === "store" && key === "id")) {
			return SLUG_LIST.test(value)
				? value
						.split(",")
						.map((part) => part.replace(/\S+/, slugValue))
						.join(",")
				: slugValue(value);
		}

		if (PRODUCT_REF_KEYS.has(lowerKey) || (kind === "product" && key === "id")) {
			return productRef(value);
		}

		if (ORDER_KEYS.has(lowerKey) || (kind === "order" && key === "id")) {
			return String(orderRef(value));
		}

		if (lowerKey === "key_prefix") {
			if (/_Ex\d\d$/.test(value)) {
				prefixes.reserved.add(value.toLowerCase());
				return value;
			}

			if (collecting) {
				prefixes.see(value);
				return value;
			}

			return prefixes.get(value) ?? value;
		}

		if (lowerKey === "compound") {
			return SENTINEL_SLUGS.includes(value.toLowerCase()) ? value : pseudonymizeProduct(value, /^[a-z0-9-]+$/.test(value));
		}

		if (lowerKey.startsWith("utm_") && !GENERIC_UTM_VALUES.includes(value.toLowerCase())) {
			if (collecting) {
				partners.see(value);
			}

			return collecting ? value : "partner";
		}

		if (key === "name" && kind === "store") {
			if (
				value
					.trim()
					.split(/\s+/)
					.every((word) => PSEUDONYM_NAME_WORDS.has(word.toLowerCase()))
			) {
				return value;
			}

			if (collecting) {
				if (context.store || !storeNames.has(value.toLowerCase())) {
					storeNames.set(value.toLowerCase(), context.store);
				}

				return value;
			}

			return generic(value, context.store);
		}

		if (PERSON_KEYS.has(lowerKey) || (key === "name" && (kind === "person" || kind === "order"))) {
			const fake = pseudonymizeWords(value, PERSON_WORDS);
			if (collecting && value.trim().length >= 4) {
				tokens.set(value.toLowerCase(), fake);
			}

			return fake;
		}

		if (key === "name" && kind === "product") {
			const fake = pseudonymizeProduct(value);
			if (collecting && value.trim().length >= 4) {
				tokens.set(value.toLowerCase(), fake);
			}

			return fake;
		}

		return generic(value, context.store, kind === "product");
	}

	function kindOf(object: Record<string, unknown>, parent: string): Kind {
		if (STORE_PARENTS.has(parent) || ["slug", "website_url", "public_store_url", "wp_url", "business_description"].some((key) => key in object)) {
			return "store";
		}

		// A vendor-miss body names a store a user asked about, with nothing else to tell it by.
		const keys = Object.keys(object);
		if (keys.includes("name") && keys.every((key) => VENDOR_MISS_KEYS.has(key))) {
			return "store";
		}

		if (PRODUCT_PARENTS.has(parent) || ["price_min", "in_stock", "variation_id"].some((key) => key in object)) {
			return "product";
		}

		if (ORDER_PARENTS.has(parent)) {
			return "order";
		}

		return PERSON_PARENTS.has(parent) ? "person" : null;
	}

	function walk(value: unknown, context: Context): unknown {
		if (typeof value === "string") {
			return transformString(value, context);
		}

		if (typeof value === "number") {
			const lowerKey = context.key.toLowerCase();
			return ORDER_KEYS.has(lowerKey) || (context.kind === "order" && context.key === "id") ? orderRef(value) : value;
		}

		if (Array.isArray(value)) {
			return value.map((item) => walk(item, context));
		}

		if (value && typeof value === "object") {
			const object = value as Record<string, unknown>;
			if (context.key === "compound") {
				// The `filters` echo's `{ slug, name }` names a compound, though `slug` would otherwise read as a store.
				return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, walk(item, { ...context, key: "compound" })]));
			}

			const kind = kindOf(object, context.key);
			const slug = typeof object["slug"] === "string" ? object["slug"] : typeof object["id"] === "string" && kind === "store" ? object["id"] : null;
			const store = kind === "store" && slug && SLUG_SHAPE.test(slug) && !SYNTHETIC_UUID.test(slug) ? slug : context.store;
			return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, walk(item, { key, kind, store })]));
		}

		return value;
	}

	let tokenPattern: RegExp | null = null;
	const root: Context = { key: "", kind: null, store: null };
	for (const document of documents) {
		walk(document, root);
	}

	const takenStores = new Set<string>();
	for (const slug of stores.seen) {
		if (isPseudonymSlug(slug)) {
			takenStores.add(slug.toLowerCase());
		}
	}

	for (const slug of stores.seen) {
		if (isPseudonymSlug(slug)) {
			continue;
		}

		const fake = takenStores.has("example-store")
			? claim(
					takenStores,
					(attempt) => `${STORE_WORDS[(hashIndex(slug.toLowerCase(), STORE_WORDS.length) + attempt) % STORE_WORDS.length] ?? "oak"}-store`
				)
			: claim(takenStores, () => "example-store");
		stores.map.set(slug.toLowerCase(), fake);
		tokens.set(slug.toLowerCase(), fake);
	}

	for (const [name, slug] of storeNames) {
		const fakeSlug = slug ? storeOf(slug) : `${STORE_WORDS[hashIndex(name, STORE_WORDS.length)] ?? "oak"}-store`;
		const fake = fakeSlug.split("-").map(capitalize).join(" ");
		if (fake.toLowerCase() !== name) {
			tokens.set(name, fake);
		}
	}

	const takenHosts = new Set<string>();
	for (const [name, slug] of hosts) {
		const fakeSlug = slug ? storeOf(slug) : null;
		const fake = fakeSlug
			? claim(takenHosts, (attempt) => `${fakeSlug === "example-store" ? "store" : fakeSlug}${attempt ? `-${attempt + 1}` : ""}.example`)
			: claim(takenHosts, (attempt) => `${STORE_WORDS[(hashIndex(name, STORE_WORDS.length) + attempt) % STORE_WORDS.length] ?? "oak"}.example`);
		hosts.set(name, fake);
		if (name !== fake) {
			tokens.set(name, fake);
		}
	}

	let next = 101;
	for (const product of products.seen) {
		const fake = claim(products.reserved, () => `sku-${(next++).toString()}`);
		products.map.set(product.toLowerCase(), fake);
		tokens.set(product.toLowerCase(), fake);
	}

	let nextOrder = 1001;
	let nextNumber = 1001;
	for (const order of orders.seen) {
		if (typeof order === "number") {
			const fake = Number(claim(orders.reserved, () => `#${(nextNumber++).toString()}`).slice(1));
			orders.map.set(keyOf(order), fake);
		} else {
			const fake = claim(orders.reserved, () => `ORD-${(nextOrder++).toString()}`);
			orders.map.set(keyOf(order), fake);
			tokens.set(order.toLowerCase(), fake);
		}
	}

	let nextUuid = 1;
	for (const uuid of uuids.seen) {
		const fake = claim(uuids.reserved, () => `00000000-0000-4000-8000-${(nextUuid++).toString().padStart(12, "0")}`);
		uuids.map.set(uuid, fake);
	}

	let nextPrefix = 1;
	for (const prefix of prefixes.seen) {
		const fake = claim(prefixes.reserved, () => `${prefix.slice(0, -4)}Ex${(nextPrefix++).toString().padStart(2, "0")}`);
		prefixes.map.set(prefix.toLowerCase(), fake);
		tokens.set(prefix.toLowerCase(), fake);
	}

	for (const partner of partners.seen) {
		tokens.set(partner.toLowerCase(), "partner");
	}

	const escaped = [...tokens.keys()]
		.filter((token) => token.length >= 3)
		.sort((a, b) => b.length - a.length)
		.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	tokenPattern = escaped.length > 0 ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
	collecting = false;
	return documents.map((document) => walk(document, root));
}
