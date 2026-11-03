# @pepreviewpro/server: a guide for coding agents

You are working in a store's codebase that uses `@pepreviewpro/server`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code. The second half covers every PepReviewPro package, so you need no other guide.

## What this package does

`new PepReviewPro({ store })` is the store's server-side client. It holds the secret key, read from `PEPREVIEWPRO_API_KEY`, so it runs on servers only: Node 20 or later, Bun, Deno, and edge runtimes. In a browser bundle it throws on import.

| Call                                            | Does                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `prp.orders.upsert(order, { request })`         | Creates or updates one order or a list, by id. The live checkout path.             |
| `prp.orders.import(source, options)`            | Sends past orders in batches of 200, with no email unless `sendEmail`.             |
| `prp.catalog.push(catalog)`                     | Replaces the store's catalog, and its shipping and payment methods when sent.      |
| `prp.reviews.list({ productRef, limit })`       | The reviews, rating, and settings the widgets show. Public, so free of key limits. |
| `prp.reviews.sync({ updatedSince, cursor })`    | A page of approved reviews, for stores that mirror them. Needs the key.            |
| `prp.reviews.syncAll({ updatedSince })`         | Every approved review, page after page, as an async iterator. Needs the key.       |
| `prp.jsonLd.product({ name, url, productRef })` | Product JSON-LD with the rating and up to 10 reviews, or null.                     |
| `prp.webhooks.verify(rawBody, headers)`         | Checks a delivery's signature and returns the event.                               |

Make one client per store and reuse it. Put it in a server-only module, like `lib/pepreviewpro.ts`, and import that from server code.

A directory partner, which lists stores rather than running one, uses `new PepReviewProPartner()` instead. It takes no store:

| Call                                            | Does                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `partner.stores.list({ compound, shipsTo })`    | A page of the directory, ranked. With `compound`, each has `matchedProducts`.    |
| `partner.products.list({ compound, stores })`   | A page of products for one compound, each with its store's slug and website.     |
| `partner.reviews.list({ store })`               | A page of approved reviews, directory-wide or one store's. Needs `reviews:read`. |
| `partner.stores.iterate(options)`               | Every store, page after page. `products.iterate` and `reviews.iterate` too.      |
| `partner.vendorMiss.report({ name, question })` | A store a user asked about that the partner could not show.                      |
| `partner.events.report(events)`                 | `shown` stores and `click` visits sent another way. Batches of 50.               |
| `partner.links.click(store, { to })`            | The tracked link, landing on `to` when it is on the store's own site.            |

The partner guide at the end of this file covers it.

## Errors to handle

- `PepReviewProApiError`: the API answered with an error. Branch on `code`, like `store_not_found`, never on `message`. Quote `requestId` to support. `isAuthError` means the key or its scope is wrong, so retrying will not help.
- `PepReviewProNetworkError`: no answer, after the retries.
- `ImportError`: an import stopped. Save `error.checkpoint` and pass it back as `checkpoint`.
- `WebhookVerificationError`: a bad signature. Answer 401 and do nothing else.
- `TypeError` or `RangeError`, thrown before any request: a bad id, a date that is not ISO 8601, more than 200 orders or 5,000 products in one call.

At checkout, catch and log a PepReviewPro error instead of failing the buyer's order. The daily re-send picks up an order a failed call missed.
