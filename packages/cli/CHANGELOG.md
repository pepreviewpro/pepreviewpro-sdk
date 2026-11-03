# @pepreviewpro/cli

## 0.2.0

### Minor Changes

- 14303b8: Ship an `AGENTS.md` in every package: a guide for AI coding agents working in a store's codebase. The `next`, `react`, and `server` guides cover every package.

  - `@pepreviewpro/cli`: every doc, help line, and message runs it as `npx @pepreviewpro/cli`, the package's own name. `init` offers to add a marked PepReviewPro block to the project's `AGENTS.md`, and to `CLAUDE.md` when there is one, pointing agents at the installed packages' guides. Running it again updates the block in place. `--no-agents` skips the step, and `--yes` answers every question for scripts and agents.
  - Every package names its repository, `github.com/pepreviewpro/pepreviewpro-sdk`, and a help-center page as its homepage, and is published with npm provenance.

- 14303b8: Error codes, cursor paging, and writes that are safe to retry.

  - `@pepreviewpro/core`: `PepReviewProApiError` reads the API's error body into `code`, `message`, `requestId`, and `details`, plus `reason` on a 429 (`rate_limit` or `monthly_quota`). Branch on `code`, typed as `ApiErrorCode`, with every known code in `API_ERROR_CODES`; `API_ERRORS` holds the messages. Every list takes `limit` (1 to 100, default 20, `MAX_PAGE_LIMIT`) and `cursor`, and answers `next_cursor`. Stores are named by `store`, their slug, in queries and bodies. `myStores` reads the stores a key reaches. Every write, `orders`, `catalog`, `heartbeat`, `vendorMiss`, and `partnerEvents`, sends one `Idempotency-Key` per call, reused across its retries; `idempotency_key_in_progress` is retried with backoff, and `idempotency_key_reused` throws. `partnerEvents` gives each event without an `id` one, kept across retries.
  - `@pepreviewpro/server`: `stores.list`, `products.list`, and `reviews.list` return one page with `nextCursor`, and `stores.iterate`, `products.iterate`, `reviews.iterate`, and `reviews.syncAll` walk every page as async iterators. `DirectoryStore` carries `slug`, `rating` (the average stars), `score` (the ranking score), `websiteUrl`, `clickUrl` (null on a key no partner is linked to), and `profileUrl`; `DirectoryProduct` carries `ref`, `pageUrl`, `clickUrl`, and its store's `slug`, `name`, and `websiteUrl`; `DirectoryReview` carries `store`, `productRef`, `author`, `verified`, `createdAt`, and `updatedAt`. `filters` and `unknownCompound` echo what the API applied. `events.report` takes an `id` per event and returns `{ recorded, duplicates, skipped }`. `OrderOutcome.id` is a string. `PepReviewPro.me()` reads the key. Webhook events name their store as `data.store`.
  - `@pepreviewpro/ai`: results name stores by `slug` and products by `ref`. The model is told each store's star `rating`, and how many more products match, from the API's own count. Links fall back to the store's own pages on a key with no partner link.
  - `@pepreviewpro/next`: the webhook route reads `data.store`, and the directory readers take the same paging options.
  - `@pepreviewpro/cli`: `doctor` checks the key with `/me` and warns about a missing scope.

- 14303b8: Add `@pepreviewpro/react` and `@pepreviewpro/next`, and `pepreviewpro webhooks test`.

  - `@pepreviewpro/react`: one component per dashboard widget, named as the dashboard names it (`<Carousel>`, `<ReviewWall>`, `<TrustBadge>`, `<FloatingBadge>`, `<ProductStars>`, `<SidebarPanel>`, `<ReviewTicker>`, `<TrustSeal>`), drawn by the widget runtime with a plain HTML copy for crawlers; an accessible `<ReviewForm>` that sends the store's own product and order ids; `useReviews`, `useAggregate`, `useStoreProfile`, `useSubmitReview`; server-rendered `<Stars>`, `<ReviewList>`, `<VerifiedBadge>`, `<ReviewsJsonLd>`; and `<PepReviewProProvider>`, which records attribution.
  - `@pepreviewpro/next`: `getReviews` and `getAggregate` cached with `unstable_cache`, or with `"use cache"` from `@pepreviewpro/next/cache-components`; `<ReviewsJsonLd>`; the webhook route `@pepreviewpro/next/webhooks` (`POST`, `createWebhookHandler`); `withPepReviewPro` from `@pepreviewpro/next/proxy`; `checkoutContext`; `cacheTags`.
  - `@pepreviewpro/server`: `signWebhook`, and `PEPREVIEWPRO_BASE_URL` as the default `baseUrl`. `jsonLd.product` no longer throws for a store that has not saved widget settings.
  - `@pepreviewpro/browser`: `attributionFromLanding` and `serializeCookie`, the rules `captureAttribution` uses, for server code.
  - `@pepreviewpro/core`: `refQuery` and the `WidgetData` type.

  How the API answers:

  - `WidgetDataResponse.settings` is `WidgetSettings | null`. It is null until the store saves its widget settings.
  - `product_ref` and `order_ref` on reviews are `string | null`, even for ids sent as numbers. `order_ref` is always null on public `widget-data`.
  - `isNumericId` is false for integers of 9,000,000,000,000 or more, which the API maps like strings. Such product ids are sent as `product_ref`.

### Patch Changes

- Updated dependencies [14303b8]
- Updated dependencies [14303b8]
- Updated dependencies [14303b8]
- Updated dependencies [14303b8]
  - @pepreviewpro/core@0.2.0
  - @pepreviewpro/server@0.2.0
