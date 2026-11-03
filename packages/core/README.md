# @pepreviewpro/core

[![npm](https://img.shields.io/npm/v/@pepreviewpro/core)](https://www.npmjs.com/package/@pepreviewpro/core) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

The typed HTTP client for the PepReviewPro API, with retries and the API's own error strings.

The other PepReviewPro packages build on this one. Most stores never install it directly: `@pepreviewpro/server` holds the key and wraps every call in your own terms. Use core for public reads, for JSON-LD helpers, or to build a wrapper of your own. It holds no secrets.

## Which package do I need?

| Your stack                                   | Install                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`       |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                            |
| A server with no React                       | `@pepreviewpro/server`, plus `@pepreviewpro/browser` on your pages      |
| Your own client over the raw API             | `@pepreviewpro/core`                                                    |
| A directory partner's site or assistant      | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next` |

## Requirements

Any runtime with `fetch`: Node 20 or later, Bun, Deno, edge runtimes, and browsers for the public reads. It has no dependencies.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/core

# npm
npm install @pepreviewpro/core

# yarn
yarn add @pepreviewpro/core
```

## Quick start

Public reads need no key.

```ts
import { PepReviewProClient } from "@pepreviewpro/core";

const client = new PepReviewProClient();
const { store, aggregate, reviews } = await client.widgetData({ site_id: "example-store", limit: 10 });
console.log(`${store.name}: ${aggregate.average_rating} from ${aggregate.total} reviews, ${reviews.length} shown`);
```

Keyed calls run on the server only, with the key from the environment:

```ts
import { PepReviewProClient } from "@pepreviewpro/core";

const client = new PepReviewProClient({ apiKey: process.env.PEPREVIEWPRO_API_KEY });
await client.orders({ store: "example-store", orders: [{ id: "ORD-1001", status: "pending", email: "buyer@example.com" }] });
```

## API

### `new PepReviewProClient(options)`

| Option            | Default                    | What it does                                                    |
| ----------------- | -------------------------- | --------------------------------------------------------------- |
| `apiKey`          | none                       | A store key. Server only. Public reads need none.               |
| `baseUrl`         | `https://pepreviewpro.com` | Another server, like a staging one.                             |
| `fetch`           | the global `fetch`         | Your own `fetch`.                                               |
| `maxRetries`      | `3`                        | Retries after the first attempt.                                |
| `baseDelayMs`     | `500`                      | The first backoff step.                                         |
| `maxDelayMs`      | `20000`                    | The longest backoff.                                            |
| `maxRetryAfterMs` | `60000`                    | A longer `Retry-After` is thrown instead of waited out.         |
| `timeoutMs`       | `30000`                    | Per attempt.                                                    |
| `userAgent`       | none                       | Sent on keyed requests only, so browser reads skip a preflight. |

### Methods

Bodies and queries use the API's own snake_case field names. Each method takes an optional `{ signal }` last.

| Method                      | Endpoint                      | Key scope       |
| --------------------------- | ----------------------------- | --------------- |
| `widgetData(query)`         | `GET /api/v1/widget-data`     | none            |
| `storeProfile({ site_id })` | `GET /api/v1/store-profile`   | none            |
| `submitReview(body)`        | `POST /api/v1/submit-review`  | none            |
| `myStores(query)`           | `GET /api/v1/my-stores`       | `store:read`    |
| `myReviews(query)`          | `GET /api/v1/my-reviews`      | `store:reviews` |
| `orders(body, options)`     | `POST /api/v1/orders`         | `store:orders`  |
| `catalog(body, options)`    | `PUT /api/v1/catalog`         | `store:catalog` |
| `heartbeat(body, options)`  | `POST /api/v1/heartbeat`      | `store:write`   |
| `stores(query)`             | `GET /api/v1/stores`          | `stores:read`   |
| `products(query)`           | `GET /api/v1/products`        | `stores:read`   |
| `reviews(query)`            | `GET /api/v1/reviews`         | `reviews:read`  |
| `vendorMiss(body, options)` | `POST /api/v1/vendor-miss`    | `partner:write` |
| `partnerEvents(body, opts)` | `POST /api/v1/partner-events` | `partner:write` |
| `me()`                      | `GET /api/v1/me`              | `me:read`       |

The last six are for directory partners. Their wire types keep the names the app gives them, like `ApiStore` and `ApiProduct`; `@pepreviewpro/server` maps them to camelCase. A store is named by its slug, as `store` in a query or a body.

Lists answer one page: up to `limit` items, 1 to 100, default 20 (`MAX_PAGE_LIMIT`), and a `next_cursor`. Pass it back as `cursor`, with the same other parameters, for the next page. It is `null` on the last one.

`orders` takes 1 to 200 orders. With `import: true` it is a backfill: orders are saved and credited, and no email is queued. `catalog` takes up to 5,000 products, and `partnerEvents` up to 50 events. Every write, `orders`, `catalog`, `heartbeat`, `vendorMiss`, and `partnerEvents`, sends an `Idempotency-Key`, yours or a generated one, and reuses it across its retries. `partnerEvents` also gives each event without an `id` one, kept across retries.

### Helpers

| Export                                   | What it does                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `productJsonLd(input)`                   | schema.org Product markup with the AggregateRating and up to 10 reviews, or `null`.                   |
| `serializeJsonLd(data)`                  | JSON for inside a `<script type="application/ld+json">`, escaped so a review cannot close the tag.    |
| `widgetRating(aggregate)`                | The number the widgets headline: the score, else the average.                                         |
| `refQuery(kind, id)`                     | Your own id as the `product_id` or `product_ref` field the API takes. `kind` is `product` or `order`. |
| `isNumericId(id)`, `assertId(id, label)` | Whether an id passes through as a number, and a check that throws on one the API refuses.             |
| `API_ERRORS`, `API_ERROR_CODES`          | The API's error messages and its stable error codes.                                                  |

```ts
import { PepReviewProClient, productJsonLd, serializeJsonLd } from "@pepreviewpro/core";

const data = await new PepReviewProClient().widgetData({ site_id: "example-store", product_ref: "sku-123" });
const markup = productJsonLd({
	name: "BPC-157 10mg",
	url: "https://store.example/products/sku-123",
	reviews: data.reviews,
	aggregate: data.aggregate
});
const tag = markup ? `<script type="application/ld+json">${serializeJsonLd(markup)}</script>` : "";
```

## Retries

429 and 5xx answers and dropped connections are retried up to 3 times, with exponential backoff and full jitter. A `Retry-After` header is never cut short. The monthly quota is not retried. `submitReview` is retried only on a 429, so a review is never saved twice. Writes repeat their `Idempotency-Key` on every retry, so a retried call is never applied twice. A write whose first try is still running (`idempotency_key_in_progress`) is retried with backoff. A key sent again with a different body (`idempotency_key_reused`) throws at once.

## Errors

- `PepReviewProApiError`: the API answered with an error. It has `status`, `code`, `message`, `requestId`, `reason`, `details`, `method`, and `path`. `code` is a stable code like `invalid_sort`, one of `API_ERROR_CODES` (the `ApiErrorCode` type): branch on it. It is undefined from the public endpoints, which send none. `message` is the API's sentence, for people and logs. `requestId` is the one to quote to support. `reason` on a 429 is `rate_limit` or `monthly_quota`, and `details` on `invalid_body` lists the problems by field. `isAuthError` and `isRateLimited` sort the common cases.
- `PepReviewProNetworkError`: the request never got an answer, after the retries.
- `TypeError` or `RangeError`, before any request: an id the API refuses, or too many orders or products in one call.

```ts
import { API_ERRORS, PepReviewProApiError, PepReviewProClient } from "@pepreviewpro/core";

try {
	await new PepReviewProClient().storeProfile({ site_id: "example-store" });
} catch (error) {
	if (error instanceof PepReviewProApiError && error.message === API_ERRORS.profileNotPublic) {
		console.log("The store's public page is off.");
	}
}
```

## Security

- Never give a client an `apiKey` in browser code. PepReviewPro keys are secret, even older ones that start with `pk_`. Keyed calls belong on your server, ideally through `@pepreviewpro/server`.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Connect a store that isn't on WordPress](https://pepreviewpro.com/help/connect-a-store-without-wordpress)
- API reference: [pepreviewpro.com/help/topics/api](https://pepreviewpro.com/help/topics/api)
- Source: [packages/core](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/packages/core)
- For AI coding agents: `node_modules/@pepreviewpro/core/AGENTS.md`

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
