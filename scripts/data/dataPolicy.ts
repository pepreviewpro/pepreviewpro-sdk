/**
 * What fictional data looks like in this repository. `pnpm scan:data` fails on anything outside these lists, and
 * `pnpm sync-fixtures` rewrites the app's recordings into these shapes on the way in. The lists say what is allowed,
 * never what is real: a list of real names would publish the names it means to keep out.
 */

/** Hosts a URL, a bare domain, or an email may use. A leading dot allows the domain and every subdomain of it. */
export const ALLOWED_HOSTS = [
	// The product, and the support address the READMEs name.
	".pepreviewpro.com",
	// Reserved for documentation by RFC 2606 and RFC 6761.
	".example.com",
	".example.org",
	".example.net",
	".test",
	".invalid",
	".localhost",
	"localhost",
	// Package registries and the CDNs that serve their schemas.
	"registry.npmjs.org",
	".npmjs.com",
	"unpkg.com",
	"esm.sh",
	// The README badges.
	"img.shields.io",
	"cdn.jsdelivr.net",
	// Specs and vocabularies the SDK implements.
	"www.standardwebhooks.com",
	"standardwebhooks.com",
	"schema.org",
	"www.w3.org",
	"json.schemastore.org",
	"semver.org",
	"keepachangelog.com",
	"opensource.org",
	"spdx.org",
	// Framework and tool docs the guides link to.
	"nextjs.org",
	"react.dev",
	"reactrouter.com",
	"remix.run",
	"astro.build",
	"docs.astro.build",
	"vite.dev",
	"vitejs.dev",
	"vitest.dev",
	"playwright.dev",
	"expressjs.com",
	"nodejs.org",
	"www.typescriptlang.org",
	"typedoc.org",
	"tsdown.dev",
	"eslint.org",
	"prettier.io",
	"pnpm.io",
	"developer.mozilla.org",
	"docs.stripe.com",
	"vercel.com",
	"docs.github.com"
];

/** github.com is allowed only under these owners: our own org and the projects the tooling names. */
export const ALLOWED_GITHUB_OWNERS = ["pepreviewpro", "standard-webhooks", "changesets", "actions", "pnpm"];

/**
 * `.example` is reserved too, but a real store's name fits under it (`<store>.example`), so only these labels pass.
 * The pseudonyms `pnpm sync-fixtures` writes are allowed by shape in `isAllowedHost`.
 */
export const ALLOWED_EXAMPLE_LABELS = [
	"store",
	"shop",
	"cdn",
	"api",
	"app",
	"www",
	"other",
	"evil",
	"attacker",
	"partner",
	"site",
	"my",
	"mail",
	"search",
	"unreachable"
];

/**
 * Store slugs that are wire features or stand-ins, not stores: `demo` is the API's preview store, `smoke` is the
 * smoke test's, `directory` is the cache tag `pepreviewpro:directory`, and the others are the unknown or throwaway
 * ids tests send.
 */
export const SENTINEL_SLUGS = ["demo", "smoke", "directory", "nope", "nobody", "none", "unknown", "missing", "s", "x", ""];

/** The words pseudonymous stores are named after: slug `maple-store`, name "Maple Store", site `maple-store.example`. */
export const STORE_WORDS = [
	"acacia",
	"alder",
	"aspen",
	"beech",
	"birch",
	"cedar",
	"cypress",
	"elm",
	"fir",
	"hazel",
	"holly",
	"juniper",
	"larch",
	"laurel",
	"linden",
	"magnolia",
	"maple",
	"oak",
	"olive",
	"pine",
	"poplar",
	"rowan",
	"sequoia",
	"spruce",
	"walnut",
	"willow",
	"yew"
];

/** Fictional name parts for reviewers and buyers. Words with accents stand in for names that have them. */
export const PERSON_WORDS = [
	"Alex",
	"Avery",
	"Blake",
	"Brooks",
	"Casey",
	"Chen",
	"Drew",
	"Ellis",
	"Garcia",
	"Hayes",
	"Jamie",
	"Jordan",
	"Kai",
	"Lane",
	"Lee",
	"Morgan",
	"Nguyen",
	"Parker",
	"Patel",
	"Quinn",
	"Reyes",
	"Riley",
	"Rivera",
	"Robin",
	"Sam",
	"Shaw",
	"Taylor"
];
export const ACCENTED_PERSON_WORDS = ["Zoë", "José", "Renée", "Søren", "Åsa", "Noël", "Inès", "Łucja"];

/**
 * The only compounds an example product may name, so a pseudonymous product reads "BPC-157 10mg". These are real
 * peptides, allowed as product names by the owner's policy and never described as anything more. No other compound
 * goes here: a product named after one is renamed to one of these six.
 */
export const PRODUCT_COMPOUNDS = ["BPC-157", "Epitalon", "KPV", "MOTS-c", "Semax", "TB-500"];

/** Words a product name keeps beside its compounds and dose, as in "BPC-157 + TB-500 Blend". */
export const PRODUCT_FORM_WORDS = ["Blend", "Capsules", "Kit", "Nasal", "Spray", "Stack", "Vial", "Vials"];

/** Neutral words for URL path segments outside a product, like a logo's file name, so `logos/basic.png` names nothing real. */
export const PATH_WORDS = ["Alpha", "Beta", "Gamma", "Delta", "Sigma", "Omega", "Nova", "Vista", "Prime", "Core", "Basic", "Plus"];

/** Product words kept as they are: measures that follow a number, like the `mg` in `10mg`. */
export const UNIT_WORDS = ["mg", "mcg", "ml", "iu", "kg", "oz", "lb", "ct", "pk", "pcs"];

/** URL path segments that describe a page rather than name a store or a product, kept as they are. */
export const GENERIC_PATH_WORDS = [
	"api",
	"v1",
	"functions",
	"embed",
	"store",
	"stores",
	"go",
	"logos",
	"banners",
	"products",
	"product",
	"p",
	"img",
	"images",
	"lab",
	"results",
	"thank",
	"you",
	"checkout",
	"cart",
	"shop",
	"mark",
	"logo",
	"banner",
	"widgets",
	"js",
	"png",
	"jpg",
	"jpeg",
	"webp",
	"svg",
	"gif"
];

/** `utm_*` values that name a channel, not a partner. Any other value is pseudonymised to `partner`. */
export const GENERIC_UTM_VALUES = ["pepreviewpro", "partner", "referral", "email", "newsletter", "cpc", "organic", "social", "widget", "review"];

/** Single findings that are fine where they are, by file and exact match, each with the reason. */
export const SCAN_EXCEPTIONS: { file: string; match: string; reason: string }[] = [
	{
		file: "scripts/release/release.test.ts",
		match: "https://github.com/someone/else",
		reason: "A repository URL that is deliberately not ours, to prove the release check rejects it."
	}
];

/**
 * Secret-shaped values that are public on purpose. The Standard Webhooks spec publishes this secret and the
 * signature it makes as test vectors, so a verifier can prove it matches every other implementation.
 */
export const PUBLIC_TEST_SECRETS = [
	"whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
	// Not a vector: the base64 of "the wrong secret entirely", which the tests sign with to see verification fail.
	"whsec_dGhlIHdyb25nIHNlY3JldCBlbnRpcmVseQ=="
];
