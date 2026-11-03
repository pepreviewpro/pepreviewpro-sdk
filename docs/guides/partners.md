---
title: Directory partners
---

# Directory partners

A directory partner lists PepReviewPro stores to its own users: a comparison site, a review roundup, or a chat assistant. This guide moves a partner from raw API calls to the SDK. Every link it builds credits you, every count it sends is sent once, and every quirk of the API is handled in one place.

## What you need

- A partner key, under **API**, **Keys** in the PepReviewPro dashboard, with **Read the vendor directory** (`stores:read`). Add **Read all reviews** (`reviews:read`) to show reviews, and `partner:write` to send reports.
- The key linked to your partner account. Email support@pepreviewpro.com to link it. Until then, reads carry no `clickUrl`, so nothing you link credits you, and `partner-events` answers 403.
- `PEPREVIEWPRO_API_KEY` set in your server environment. The key is secret, even though it starts with `pk_live_`.

| You are building                | Install                                     |
| ------------------------------- | ------------------------------------------- |
| A chat assistant on the AI SDK  | `@pepreviewpro/ai` `@pepreviewpro/server`   |
| A directory site on Next.js     | `@pepreviewpro/next` `@pepreviewpro/server` |
| A directory on any other server | `@pepreviewpro/server`                      |

## The client

`PepReviewProPartner` takes no store. It reads the key from `PEPREVIEWPRO_API_KEY`, and it throws if it is imported in a browser bundle.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

const page = await partner.stores.list({ compound: "bpc-157", shipsTo: "US", sort: "best", limit: 10 });
for (const store of page.stores) {
	const product = store.matchedProducts?.[0];
	console.log(
		`${store.name} is rated ${store.rating} from ${store.reviewCount} reviews. ${product ? `${product.name}: ${product.clickUrl}` : store.clickUrl}`
	);
}
```

Reads return camelCase objects. Each is the wire's `Api*` type from `@pepreviewpro/core` without the prefix: `ApiStore` becomes `DirectoryStore`, and `website_url` becomes `websiteUrl`. A store is named by its `slug`, and a product by its `ref`. `rating` is a store's average stars; `score` is the PepReviewPro score that ranks the directory. Show `rating`.

Each list is one page with a `nextCursor`. Pass it back as `cursor` for the next page, or let `iterate` walk them all:

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

for await (const product of partner.products.iterate({ compound: "bpc-157", limit: 100 })) {
	console.log(product.store.name, product.name, product.priceMin);
}
```

## Links that credit you

| Link                    | Tracked | Use it for                                                         |
| ----------------------- | ------- | ------------------------------------------------------------------ |
| `clickUrl`              | yes     | Sending a buyer to the store's site, or to a product's page.       |
| `profileUrl`            | yes     | Sending a buyer to the store's PepReviewPro page with its reviews. |
| `websiteUrl`, `pageUrl` | no      | Nothing. A visit through them earns you no credit.                 |

To land a buyer on a page of your own, like an affiliate link, keep the tracked link and pass the page as `to`. PepReviewPro honours `to` only on the store's own site and its subdomains, so `links.click` adds it only there:

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();
const [store] = (await partner.stores.list({ search: "Example" })).stores;
if (store) {
	console.log(partner.links.click(store, { to: "https://store.example/?ref=partner" }));
}
```

A link elsewhere earns no credit by itself. Report the visit as a `click` event with `partner.events.report`.

## What the API does that the SDK handles

| The API                                                         | The SDK                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Grouping `/products` by store pages by product, not by store.   | `stores.list({ compound })` returns each store with up to three `matchedProducts`.         |
| Lists page by cursor.                                           | `iterate` follows `next_cursor` for you, a page at a time.                                 |
| An unknown compound answers an empty list.                      | `unknownCompound` reads the API's answer, and the AI tool says what it could not find.     |
| `vendor-miss` keeps the first 120 characters of a name.         | `vendorMiss.report` trims the name to 120, the question to 200, and the address to 500.    |
| Writes count on arrival.                                        | Each call carries an `Idempotency-Key`, so its retries are never counted twice.            |
| `partner-events` drops an event whose `id` it has seen.         | Every event gets an `id`, yours or a generated one that its retries reuse.                 |
| `partner-events` takes 50 events a call.                        | `events.report` sends batches of 50 and adds up `recorded`, `duplicates`, and `skipped`.   |
| A 429 asks you to wait a second; a monthly quota waits a month. | Short retries for a waiting page or chat: at most 2 seconds between tries, then it throws. |

## A directory page on Next.js

`@pepreviewpro/next` caches the reads for five minutes under the tag `pepreviewpro:directory`. With `cacheComponents: true`, import them from `@pepreviewpro/next/cache-components`.

Caching has one cost. Your reads count as your impressions in each store's insights, and a page served from the cache never reaches the API. Report what a cached page shows as `shown` events, after the response. From your first `shown` event on, only `shown` events count as your impressions, so send one for every store you show, cached or not:

```tsx
import { getDirectoryStores } from "@pepreviewpro/next";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { after } from "next/server";

const partner = new PepReviewProPartner();

export default async function Page() {
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
						<a href={store.clickUrl ?? store.profileUrl}>{store.name}</a> is rated {store.rating.toFixed(1)}.{" "}
						<a href={store.profileUrl}>Read its reviews</a>
					</li>
				))}
			</ul>
		</main>
	);
}
```

## A chat assistant on the AI SDK

`createFindVendorsTool` is the whole integration. It reads the directory with the compound, country, and payment the user asked for. When a filter matches nothing it lets it go, in up to four reads, and says which. It reports a store the user named that the directory lacks. The model reads a short list of facts to state, and your app draws cards from the tool's output.

```ts
// app/api/chat/route.ts
import { createFindVendorsTool, FIND_VENDORS_INSTRUCTIONS } from "@pepreviewpro/ai";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

const partner = new PepReviewProPartner({ maxRetries: 1, timeoutMs: 5000 });

export async function POST(request: Request) {
	const { messages }: { messages: UIMessage[] } = await request.json();
	const result = streamText({
		model: "openai/gpt-5-mini",
		system: FIND_VENDORS_INSTRUCTIONS,
		messages: await convertToModelMessages(messages),
		tools: {
			find_vendors: createFindVendorsTool(partner, {
				resolveCompound: (text) => (text.toLowerCase() === "bpc" ? "bpc-157" : text),
				overlayLinks: (store) => (store.slug === "example-store" ? { url: "https://store.example/?ref=partner", discountCode: "PARTNER10" } : null)
			})
		},
		stopWhen: stepCountIs(3)
	});
	return result.toUIMessageStreamResponse();
}
```

Link `store.link` and `product.link` on each card. They are tracked, and they carry your overlay when it is on the store's own site. The [`@pepreviewpro/ai` README](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/packages/ai) lists every option.

## Moving from raw calls

| You called                               | Call instead                        |
| ---------------------------------------- | ----------------------------------- |
| `GET /api/v1/stores`                     | `partner.stores.list(options)`      |
| `GET /api/v1/products`, grouped by store | `partner.stores.list({ compound })` |
| `GET /api/v1/products`                   | `partner.products.list(options)`    |
| `GET /api/v1/reviews`                    | `partner.reviews.list(options)`     |
| `POST /api/v1/vendor-miss`               | `partner.vendorMiss.report(input)`  |
| `POST /api/v1/partner-events`            | `partner.events.report(events)`     |
| `GET /api/v1/me`                         | `partner.me()`                      |
| `website_url` or `page_url` in a link    | `clickUrl` or `profileUrl`          |

The SDK calls `https://pepreviewpro.com/api/v1`.

Errors carry the API's stable `code`. Branch on `PepReviewProApiError.code`, like `not_partner_key` for a key not yet linked to your partner account, and quote `requestId` to support.
