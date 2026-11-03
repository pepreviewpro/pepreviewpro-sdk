---
"@pepreviewpro/core": minor
"@pepreviewpro/server": minor
"@pepreviewpro/next": minor
"@pepreviewpro/ai": minor
"@pepreviewpro/cli": minor
---

Error codes, cursor paging, and writes that are safe to retry.

- `@pepreviewpro/core`: `PepReviewProApiError` reads the API's error body into `code`, `message`, `requestId`, and `details`, plus `reason` on a 429 (`rate_limit` or `monthly_quota`). Branch on `code`, typed as `ApiErrorCode`, with every known code in `API_ERROR_CODES`; `API_ERRORS` holds the messages. Every list takes `limit` (1 to 100, default 20, `MAX_PAGE_LIMIT`) and `cursor`, and answers `next_cursor`. Stores are named by `store`, their slug, in queries and bodies. `myStores` reads the stores a key reaches. Every write, `orders`, `catalog`, `heartbeat`, `vendorMiss`, and `partnerEvents`, sends one `Idempotency-Key` per call, reused across its retries; `idempotency_key_in_progress` is retried with backoff, and `idempotency_key_reused` throws. `partnerEvents` gives each event without an `id` one, kept across retries.
- `@pepreviewpro/server`: `stores.list`, `products.list`, and `reviews.list` return one page with `nextCursor`, and `stores.iterate`, `products.iterate`, `reviews.iterate`, and `reviews.syncAll` walk every page as async iterators. `DirectoryStore` carries `slug`, `rating` (the average stars), `score` (the ranking score), `websiteUrl`, `clickUrl` (null on a key no partner is linked to), and `profileUrl`; `DirectoryProduct` carries `ref`, `pageUrl`, `clickUrl`, and its store's `slug`, `name`, and `websiteUrl`; `DirectoryReview` carries `store`, `productRef`, `author`, `verified`, `createdAt`, and `updatedAt`. `filters` and `unknownCompound` echo what the API applied. `events.report` takes an `id` per event and returns `{ recorded, duplicates, skipped }`. `OrderOutcome.id` is a string. `PepReviewPro.me()` reads the key. Webhook events name their store as `data.store`.
- `@pepreviewpro/ai`: results name stores by `slug` and products by `ref`. The model is told each store's star `rating`, and how many more products match, from the API's own count. Links fall back to the store's own pages on a key with no partner link.
- `@pepreviewpro/next`: the webhook route reads `data.store`, and the directory readers take the same paging options.
- `@pepreviewpro/cli`: `doctor` checks the key with `/me` and warns about a missing scope.
