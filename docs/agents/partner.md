## Directory partners, every package

A directory partner lists PepReviewPro stores to its own users: a comparison site, a review roundup, or a chat assistant. PepReviewPro collects verified reviews from each store's buyers, and partners show the stores and their ratings. Every link a partner sends through PepReviewPro tells the store the visit came from that partner. Read this once before you plan the work.

### Which packages to install

| The project is                          | Install                                     | Notes                                                                               |
| --------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| A chat assistant on the AI SDK          | `@pepreviewpro/ai` `@pepreviewpro/server`   | `createFindVendorsTool(partner)` is the whole integration.                          |
| A directory or comparison site, Next.js | `@pepreviewpro/next` `@pepreviewpro/server` | `getDirectoryStores` and friends cache the reads. See the caching rule below.       |
| A directory on any other server         | `@pepreviewpro/server`                      | `new PepReviewProPartner()` and its `stores.list`, `products.list`, `reviews.list`. |

A partner never needs `@pepreviewpro/react`, `@pepreviewpro/browser`, or `@pepreviewpro/cli`, which are for a store's own site.

### Rules that matter most

1. **The key is secret and server only.** A partner key starts with `pk_live_`. Despite the prefix, it is as secret as any key. Read it from `PEPREVIEWPRO_API_KEY` on the server. Never give it a `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` name, and never commit it. If you cannot get it, ask the person you work for. It comes from the PepReviewPro dashboard, under **API**, **Keys**, with **Read the vendor directory** (`stores:read`), and `partner:write` for reports.
2. **Link `clickUrl` and `profileUrl`, never the raw ones.** `clickUrl` goes to the store or product through PepReviewPro, and `profileUrl` to the store's PepReviewPro page with the partner's name on it. `websiteUrl` and `pageUrl` are untracked: a visit through them earns no credit. On a key not yet linked to a partner, `clickUrl` is `null`. To land on a page of your own choosing on the store's site, use `partner.links.click(store, { to })`.
3. **A store is named by its `slug`,** like `example-store`, and a product by its `ref`. Use them for `store` and `productRef` in events, and `store` in reviews. Show `rating`, the average stars. `score` ranks the directory and is not a star rating.
4. **Ask for a compound with `compound`, a country with `shipsTo`, and a name with `search`.** `search` only matches store names. With `compound`, `stores.list` returns each store's `matchedProducts`, so there is no need to group `products.list` by store.
5. **An empty answer is an answer.** The API never drops a filter to fill a list, and an unknown compound matches nothing. Say so, or relax the filters yourself and say which. The AI tool does both.
6. **Report what you show.** Your reads count as your impressions until your first `shown` event; from then on only `shown` events do. A page served from a cache never reaches the API, so report what every page shows: `partner.events.report([{ id, type: "shown", store, placement: "finderStore" }], { background: true })`.
7. **Lists are pages.** Each has `nextCursor`; pass it back as `cursor`, or loop over `partner.stores.iterate(options)`. `limit` is 1 to 100.
8. **Never retry a report yourself.** `vendorMiss.report` and `events.report` are counted on arrival. The SDK retries them with the same `Idempotency-Key`, so its retries count once; a retry of your own is a new call. Give each event an `id` of your own, like the page view's id and the store's slug, and a resent event counts once.

### A directory page on Next.js

```tsx
import { getDirectoryStores } from "@pepreviewpro/next";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { after } from "next/server";

const partner = new PepReviewProPartner();

export default async function VendorsPage() {
	const { stores } = await getDirectoryStores({ compound: "bpc-157", sort: "best", limit: 12 });
	after(() =>
		partner.events.report(
			stores.map((store) => ({ type: "shown" as const, store: store.slug, compound: "bpc-157", placement: "finderStore" as const }))
		)
	);
	return (
		<main id="main-content">
			<h1>Where to buy BPC-157</h1>
			<ul>
				{stores.map((store) => (
					<li key={store.slug}>
						<a href={store.clickUrl ?? store.profileUrl}>{store.name}</a> is rated {store.rating.toFixed(1)} from {store.reviewCount} reviews.{" "}
						<a href={store.profileUrl}>Read the reviews</a>
					</li>
				))}
			</ul>
		</main>
	);
}
```

With `cacheComponents: true`, import `getDirectoryStores`, `getDirectoryProducts`, and `getDirectoryReviews` from `@pepreviewpro/next/cache-components` instead. Both cache for five minutes under the tag `pepreviewpro:directory`.

### A store your user asked about

When a user names a store you cannot show, report it, so PepReviewPro can invite the store. The SDK trims the name to 120 characters and the question to 200.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

partner.vendorMiss.report({ name: "Juniper Store", question: "Is Juniper Store reviewed anywhere?" }, { background: true });
```

### Verify your work

- [ ] The key appears only as `process.env.PEPREVIEWPRO_API_KEY` in server code.
- [ ] Every store and product link in the HTML or in the assistant's answers starts with `https://pepreviewpro.com/go/` or `https://pepreviewpro.com/vendors/`.
- [ ] Every page reports `shown` events for the stores it shows, cached or not.
- [ ] Nothing retries `vendorMiss.report` or `events.report` in a loop of its own.
- [ ] The project's own typecheck, lint, and tests pass.

### More

- Help center: https://pepreviewpro.com/help/create-an-api-key
- Every package's README is in `node_modules/@pepreviewpro/<name>/README.md`, and its types are in `dist/*.d.ts`.
- Working example: https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/partner-next
- Questions for PepReviewPro: support@pepreviewpro.com
