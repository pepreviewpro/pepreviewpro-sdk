# @pepreviewpro/server

[![npm](https://img.shields.io/npm/v/@pepreviewpro/server)](https://www.npmjs.com/package/@pepreviewpro/server) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

PepReviewPro on your server: orders from checkout, past orders, your catalog, server-rendered reviews, JSON-LD, and webhooks. For directory partners, the store directory with tracked links.

PepReviewPro collects verified reviews from your buyers. You send your orders, and PepReviewPro asks each buyer for a review and matches it to the order. This package is the server half of that, for any stack. It holds your store's secret key, so it runs on the server only.

## Which package do I need?

| Your stack                                   | Install                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`  |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                       |
| A server with no React                       | `@pepreviewpro/server`, plus `@pepreviewpro/browser` on your pages |
| Setup, imports, and checks                   | `npx @pepreviewpro/cli` from `@pepreviewpro/cli`                   |
| A directory or assistant that lists stores   | `@pepreviewpro/server`, plus `@pepreviewpro/ai` for an AI SDK tool |

## Requirements

- Node 20 or later, Bun, Deno, or an edge runtime such as Vercel's or Cloudflare Workers. It uses `fetch` and Web Crypto, and no Node built-ins.
- A store key from the PepReviewPro dashboard: **Widgets**, **Integrations**, the **Next.js** or **React** tab, **Store key**.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/server

# npm
npm install @pepreviewpro/server

# yarn
yarn add @pepreviewpro/server
```

Set the key and your store's slug in your server environment. `npx @pepreviewpro/cli init` checks the key and writes both to `.env.local`.

```sh
PEPREVIEWPRO_API_KEY=sk_live_...   # secret, server only
PEPREVIEWPRO_STORE=example-store   # your store's slug
```

## Quick start

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: "example-store" });

const { store, aggregate } = await prp.reviews.list({ limit: 5 });
console.log(`${store.name} has ${aggregate.total} reviews.`);
```

Then send each order from your checkout. Pass the request, and the SDK reads the buyer's attribution and reviews-seen cookies, IP address, and user agent from it. `saveOrder` stands for your own checkout code.

```ts
// app/api/checkout/route.ts, or any Fetch route handler
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function POST(request: Request) {
	const order = await saveOrder(await request.json());
	await prp.orders.upsert(
		{
			id: order.number,
			status: "paid",
			email: order.email,
			name: order.name,
			total: order.total,
			currency: order.currency,
			createdAt: order.createdAt,
			lineItems: order.items.map((item) => ({ productId: item.sku, name: item.title, quantity: item.quantity, total: item.total }))
		},
		{ request }
	);
	return Response.json({ ok: true });
}
```

Ids can be strings, like `ORD-1001` and `sku-123`. Every answer echoes your own id.

## API

### `new PepReviewPro(options)`

| Option          | Default                                                  | What it does                                                                             |
| --------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `store`         | required                                                 | Your store's slug, like `example-store`. Not its id.                                     |
| `apiKey`        | `PEPREVIEWPRO_API_KEY`                                   | Your store key. Public reads work without one.                                           |
| `webhookSecret` | `PEPREVIEWPRO_WEBHOOK_SECRET`                            | The webhook endpoint's `whsec_` secret.                                                  |
| `baseUrl`       | `PEPREVIEWPRO_BASE_URL`, then `https://pepreviewpro.com` | Another server, like a staging one.                                                      |
| `fetch`         | the global `fetch`                                       | Your own `fetch`.                                                                        |
| `maxRetries`    | `3`                                                      | Retries after the first attempt.                                                         |
| `timeoutMs`     | `30000`                                                  | Per attempt.                                                                             |
| `heartbeat`     | on                                                       | `false` turns off the daily check-in. An object declares `framework` and `capabilities`. |
| `waitUntil`     | none                                                     | Keeps a serverless function alive for the check-in, like Vercel's `waitUntil`.           |

### Orders

<!-- snippet: partial -->

```ts
prp.orders.upsert(order: Order, options?: UpsertOptions): Promise<OrderOutcome>
prp.orders.upsert(orders: Order[], options?: UpsertOptions): Promise<OrderOutcome[]>
prp.orders.import(source: Iterable<Order> | AsyncIterable<Order>, options?: ImportOptions): Promise<ImportTotals & { checkpoint }>
```

`upsert` creates or updates by id, so sending an order twice is safe: the repeat comes back `unchanged`. Send it again whenever its status changes. Each `OrderOutcome` is `{ id, status, queued, duplicates, skippedReason? }`, with your `id` as a string.

- `status` is `pending`, `paid`, `completed`, `refunded`, or `cancelled`.
- A review request is queued when the order reaches your store's trigger status, `completed` unless you chose `paid` in the dashboard.
- `refunded` and `cancelled` stop a request that has not gone out yet.
- Without `email` and `lineItems`, no request can go out. The first line item names the request.

| `UpsertOptions`  | What it does                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `request`        | The checkout request: a Fetch `Request`, or anything with `headers`, like an Express request.             |
| `context`        | What `readCheckoutContext()` from `@pepreviewpro/browser` returned, when checkout runs on another domain. |
| `idempotencyKey` | Your own key for the call, like the checkout's id. One is generated otherwise, and reused across retries. |
| `signal`         | An `AbortSignal`.                                                                                         |

The request fills only the fields the order leaves out. When the browser sends Global Privacy Control (`Sec-GPC: 1`), nothing is read from it.

### Import past orders

`orders.import` sends any list or async iterable of orders in batches of 200. It queues no email, so it is safe for your whole history.

```ts
import { ImportError, PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

try {
	await prp.orders.import(allPastOrders(), {
		checkpoint: await loadCheckpoint(),
		onProgress: (progress) => saveCheckpoint(progress.checkpoint)
	});
} catch (error) {
	if (error instanceof ImportError) {
		await saveCheckpoint(error.checkpoint);
	}

	throw error;
}
```

A failed batch throws an `ImportError` whose `checkpoint` says where to pick up. Pass it back to resume. `npx @pepreviewpro/cli import-orders orders.csv` does the same from a file.

### Re-send recent orders each day

Checkout calls miss orders when either side is down. A daily job that sends the last 48 hours again, with email on, catches them. Orders PepReviewPro already has come back `unchanged`, and a missed one is created and its request goes out late instead of never.

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

await prp.orders.import(ordersUpdatedSince(new Date(Date.now() - 48 * 60 * 60 * 1000)), { sendEmail: true });
```

Use `sendEmail` only for a recent window like this one, never for your history.

### Catalog

<!-- snippet: partial -->

```ts
prp.catalog.push(catalog: CatalogInput): Promise<{ products: number; mapped: number; skipped: number }>
```

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

await prp.catalog.push({
	products: [
		{
			id: "sku-123",
			name: "BPC-157 10mg",
			url: "https://store.example/products/sku-123",
			priceMin: 49.5,
			priceMax: 49.5,
			currency: "USD",
			inStock: true
		}
	],
	shipsTo: ["US", "CA"],
	shipsFrom: "US",
	paymentMethods: ["card", "crypto"]
});
```

Send the whole catalog each time, up to 5,000 products. Leave out `shipsTo`, `shipsFrom`, or `paymentMethods` to keep what PepReviewPro has. Payment methods are `card`, `crypto`, `bankTransfer`, `zelle`, `cashApp`, `venmo`, `paypal`, and `other`.

### Reviews for server rendering

<!-- snippet: partial -->

```ts
prp.reviews.list(options?: { productRef?; limit? }): Promise<ReviewsList>
prp.reviews.sync(options?: { updatedSince?; cursor?; productRef?; limit? }): Promise<ReviewsSyncPage>
prp.reviews.syncAll(options?: { updatedSince?; productRef?; limit? }): AsyncGenerator<MyReview>
```

`reviews.list` returns `{ store, settings, reviews, aggregate }`, the same public data the widgets show, so page renders never count against your key. `limit` is 1 to 50. Cache it on your side for a few minutes, and pass it to the React widgets as `data`.

`reviews.sync` returns one page of your approved reviews, `{ reviews, aggregate, nextCursor }`, for stores that copy them into their own database. Pass `nextCursor` back as `cursor` for the next page; it is `null` on the last. `syncAll` walks every page for you. Both need the key. With `updatedSince`, reviews come oldest change first, each with `updated_at`, so the newest copy wins. Each review has `id`, `store`, `product_ref`, `order_ref`, `rating`, `title`, `body`, `author`, `verified`, `created_at`, and `updated_at`.

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

const startedAt = new Date();
for await (const review of prp.reviews.syncAll({ updatedSince: await lastReviewSync() })) {
	await saveReview(review);
}

await saveLastReviewSync(startedAt);
```

### JSON-LD

<!-- snippet: partial -->

```ts
prp.jsonLd.product(options: ProductJsonLdOptions): Promise<ProductJsonLd | null>
```

```ts
import { serializeJsonLd } from "@pepreviewpro/core";
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

const jsonLd = await prp.jsonLd.product({ name: "BPC-157 10mg", url: "https://store.example/products/sku-123", productRef: "sku-123" });
const tag = jsonLd ? `<script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>` : "";
```

Product markup with your AggregateRating and up to 10 Review nodes, with the rating the widget shows. Pass `data` from `reviews.list` to reuse a fetch, and `offers` to keep one Product node on the page. It returns `null` for a product with no reviews and no offers. `serializeJsonLd` escapes the markup so a review cannot close the script tag.

There is no Organization variant. Google shows no stars for reviews a business hosts about itself.

### Webhooks

<!-- snippet: partial -->

```ts
prp.webhooks.verify(rawBody: string | Uint8Array, headers): Promise<WebhookEvent>
verifyWebhook(rawBody, headers, { secret }): Promise<WebhookEvent>
signWebhook({ secret, body }): Promise<Record<string, string>>
```

Deliveries are signed with [Standard Webhooks](https://www.standardwebhooks.com). Pass the raw body, `await request.text()`, not parsed JSON. A bad signature, or a timestamp more than five minutes off, throws `WebhookVerificationError`.

```ts
import { PepReviewPro, WebhookVerificationError } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function POST(request: Request) {
	try {
		const event = await prp.webhooks.verify(await request.text(), request.headers);
		if (event.type !== "ping") {
			await clearReviewCache(event.data.store);
		}

		return Response.json({ received: true });
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			return Response.json({ error: error.message }, { status: 401 });
		}

		throw error;
	}
}
```

Every event's `data` carries `store`, the store's slug. Deliveries can repeat and arrive out of order. Drop repeats by `event.id`, and treat an event as a reason to fetch again, not as data to keep. The events are `review.published`, `review.updated`, `review.deleted`, `store.updated`, `aggregate.changed`, and `ping`. On Next.js, `@pepreviewpro/next/webhooks` is the whole route. `signWebhook` returns the headers PepReviewPro would send, for testing a route of your own.

### Request helpers

`readRequestContext(request)` returns `{ attribution, reviewsSeenAt, ip, userAgent }` from a checkout request. `clientIp(headers)` reads `X-Forwarded-For`, then `X-Real-IP`, then `CF-Connecting-IP`. `parseCookieHeader(header)` decodes a `Cookie` header.

### The Connection card

The dashboard's **Connection** card shows the SDK once it hears from it. The package checks in once a day per process, in the background, after its first call that works, and only with a key. Declare what your store uses so the card is complete from the first check-in:

```ts
import { PepReviewPro } from "@pepreviewpro/server";

export const prp = new PepReviewPro({
	store: process.env.PEPREVIEWPRO_STORE!,
	heartbeat: { framework: "next@16", capabilities: ["orders", "attribution", "reviewsSeen", "jsonLd"] }
});
```

The check-in needs the key's `store:write` scope, which store keys have. `prp.me()` returns the key's `type`, `scopes`, and this month's usage, for a health check of your own. A store key has no monthly quota, so its `monthlyQuota` and `remainingThisMonth` are `null`.

## For directory partners

A directory partner lists PepReviewPro stores to its own users: a price-comparison site, a review roundup, or a chat assistant. `PepReviewProPartner` is its client. It takes no store, since a partner reads them all, and it holds your partner key, so it runs on the server only.

Create a key in the dashboard under **API**, **Keys**, with **Read the vendor directory** (`stores:read`), plus **Read all reviews** (`reviews:read`) if you show reviews. Reports need `partner:write`. Ask support@pepreviewpro.com to link it to your partner account: that is what credits your clicks. Set it as `PEPREVIEWPRO_API_KEY` on the server.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

const { stores } = await partner.stores.list({ compound: "bpc-157", shipsTo: "US", limit: 10 });
for (const store of stores) {
	console.log(`${store.name}: rated ${store.rating} from ${store.reviewCount} reviews. Link: ${store.clickUrl}`);
}
```

### Link `clickUrl` and `profileUrl`

Every store and product carries two kinds of link. Only the tracked ones tell the store the visit came from you.

| Field                   | Tracked | Goes to                                                                  |
| ----------------------- | ------- | ------------------------------------------------------------------------ |
| `clickUrl`              | yes     | The store's site, or a product's page, through PepReviewPro. Link this.  |
| `profileUrl`            | yes     | The store's PepReviewPro page, tagged with your partner name. Link this. |
| `websiteUrl`, `pageUrl` | no      | The same site or page, untracked. Show it as text if you must.           |

`clickUrl` is `null` on a key no partner is linked to, and so is what `links.click` returns for it. To land a buyer on a page of your choosing, like an affiliate link, pass it through the tracked link: `partner.links.click(store, { to })`. It adds `to` only when the page is on the store's own website or a subdomain of it, since PepReviewPro ignores any other. A product from `products.list` is checked against its store's `websiteUrl`.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();
const { stores } = await partner.stores.list({ search: "Example" });
const href = stores[0] ? partner.links.click(stores[0], { to: "https://store.example/?ref=partner" }) : null;
```

### `new PepReviewProPartner(options)`

| Option       | Default                                                  | What it does                                                          |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------------------- |
| `apiKey`     | `PEPREVIEWPRO_API_KEY`                                   | Your partner key.                                                     |
| `baseUrl`    | `PEPREVIEWPRO_BASE_URL`, then `https://pepreviewpro.com` | Another server, like a staging one.                                   |
| `fetch`      | the global `fetch`                                       | Your own `fetch`.                                                     |
| `maxRetries` | `2`                                                      | Retries after the first attempt.                                      |
| `timeoutMs`  | `10000`                                                  | Per attempt.                                                          |
| `waitUntil`  | none                                                     | Keeps a serverless function alive for reports sent with `background`. |

Backoff stays short, at most 2 seconds between tries, and a `Retry-After` over 5 seconds is thrown rather than waited out, since a page or a chat turn is waiting.

### Partner methods

| Call                                                    | Does                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `partner.stores.list(options)`                          | One page of the directory, ranked. With `compound`, only stores that carry it, each with up to 3 `matchedProducts`. |
| `partner.products.list({ compound, ... })`              | One page of products for one compound, each with its store. `stores` filters by slug before paging.                 |
| `partner.reviews.list({ store, ... })`                  | One page of approved reviews across the directory, or one store's, newest first. Needs `reviews:read`.              |
| `stores.iterate`, `products.iterate`, `reviews.iterate` | The same options, every item of every page, fetched as your loop reads them.                                        |
| `partner.vendorMiss.report({ name, ... })`              | A store your user asked about that you could not show. Trims `name` to 120 and `question` to 200.                   |
| `partner.events.report(events)`                         | `shown` stores and `click` visits you sent another way, in batches of 50.                                           |
| `partner.links.click(storeOrProduct, { to })`           | The tracked link, landing on `to` when it is on the store's own site.                                               |
| `partner.me()`                                          | Your key's scopes and this month's usage.                                                                           |

`stores.list` and `products.list` take `compound`, `shipsTo`, `payment`, `inStock`, `minRating`, `sort`, `limit`, and `cursor`, and `stores.list` takes `search`. Each page has `total` and `nextCursor`; pass `nextCursor` back as `cursor` for the next, or use `iterate`. A compound the API does not know matches nothing, and the page says so: `unknownCompound` is `true`. `filters` echoes what the API applied, with the compound as its library names it. An empty `shipsTo` on a store means unknown, not nowhere.

A store's `rating` is its average star rating. `score` is the PepReviewPro score that ranks the directory and that `minRating` compares. Show `rating`.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

for await (const store of partner.stores.iterate({ shipsTo: "US", limit: 100 })) {
	console.log(store.slug, store.rating);
}
```

Your reads count as your impressions in each store's insights until you send your first `shown` event. From then on, only `shown` events count, so send one for every store you show. `events.report` returns `{ recorded, duplicates, skipped }`. Give each event an `id` of your own, like the id of the page view or chat message that showed it, and a report sent twice is counted once. Without one, each event gets an `id` that its retries reuse. `vendorMiss.report` and `events.report` send an `Idempotency-Key` with each call, and each batch, so a retry is never counted twice. Pass `{ background: true }` to send either without waiting: it hands the send to `waitUntil` and never throws.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

partner.vendorMiss.report({ name: "Juniper Store", question: "Is Juniper Store a good place to buy BPC-157?" }, { background: true });
partner.events.report([{ id: "view-1001:example-store", type: "shown", store: "example-store", compound: "bpc-157", placement: "finderStore" }], {
	background: true
});
```

For a chat assistant on the AI SDK, `@pepreviewpro/ai` wraps all of this in one tool. On Next.js, `@pepreviewpro/next` caches the reads. The [partner guide](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/partners.md) walks through both.

### The naming convention

Partner reads return camelCase objects. Each is the wire's `Api*` type from `@pepreviewpro/core` without the prefix and in camelCase: `ApiStore` is `DirectoryStore`, and `website_url` is `websiteUrl`. A store is named by its `slug` and a product by its `ref`, the store's own id for it. The raw links get names that say what they are, `websiteUrl` and `pageUrl`, so the tracked `clickUrl` is the one that reads as the link.

## Errors

| Error                      | When                                                                                    | What to do                                           |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PepReviewProApiError`     | The API answered with an error.                                                         | Branch on `code`. Quote `requestId` to support.      |
| `PepReviewProNetworkError` | No answer after the retries: DNS, TLS, a reset, or the timeout.                         | Try later. The daily re-send catches a missed order. |
| `ImportError`              | An import batch failed.                                                                 | Save `checkpoint`, and pass it back to resume.       |
| `WebhookVerificationError` | A delivery's signature or timestamp is wrong.                                           | Answer 401, and do nothing else with it.             |
| `TypeError`, `RangeError`  | Before any request: a bad id or date, or more than 200 orders or 5,000 products a call. | Fix the input.                                       |

`PepReviewProApiError` carries `status`, `code`, `message` (the API's own sentence), `requestId`, `reason` on a 429 (`rate_limit` or `monthly_quota`), and `details` on `invalid_body`. `isAuthError` is true when the key is missing, unknown, revoked, or lacks the scope, so retrying will not help.

```ts
import { PepReviewPro, PepReviewProApiError } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

try {
	await prp.orders.upsert({ id: "ORD-1001", status: "pending" });
} catch (error) {
	if (error instanceof PepReviewProApiError && error.code === "revoked_api_key") {
		console.error("The PepReviewPro key was revoked. Create a new one in the dashboard.");
	}

	throw error;
}
```

Calls retry 429 and 5xx answers and dropped connections up to 3 times, with backoff, and honor `Retry-After`. The monthly quota is not retried. Every write sends one `Idempotency-Key` and repeats it on each retry, so a retry is never applied twice. A write still running on PepReviewPro's side is retried; a key reused with another body throws `idempotency_key_reused`. Every failure from a keyed endpoint carries a stable `code`, like `invalid_sort`, from `API_ERROR_CODES`: branch on it, not on the message.

## Security

- **The key is secret.** Despite the `pk_` prefix on older keys, no PepReviewPro key is publishable. Keep it in a server environment variable, never in browser code, and never in a `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` variable.
- Importing this package in a browser bundle throws, so a key cannot ship by accident through it.
- `npx @pepreviewpro/cli doctor` scans your client build for a key.
- IP addresses and user agents are hashed when they reach PepReviewPro.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Connect a store that isn't on WordPress](https://pepreviewpro.com/help/connect-a-store-without-wordpress), [Send orders from your checkout](https://pepreviewpro.com/help/send-orders-from-your-checkout), [Import your past orders](https://pepreviewpro.com/help/import-your-past-orders), [Keep your pages current with webhooks](https://pepreviewpro.com/help/keep-your-pages-current-with-webhooks), [Show your products and shipping](https://pepreviewpro.com/help/show-your-products-and-shipping)
- API reference: [pepreviewpro.com/help/topics/api](https://pepreviewpro.com/help/topics/api)
- Guides: [Next.js, end to end](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/nextjs.md), [Any other stack](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/any-stack.md)
- Example: [Express and Stripe](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/express-stripe)
- Partners: [the partner guide](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/partners.md), [Create an API key](https://pepreviewpro.com/help/create-an-api-key)
- For AI coding agents: `node_modules/@pepreviewpro/server/AGENTS.md`

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
