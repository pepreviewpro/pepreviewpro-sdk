# @pepreviewpro/browser

## 0.3.0

No changes in this release.

## 0.2.0

### Minor Changes

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

- 14303b8: Ship an `AGENTS.md` in every package: a guide for AI coding agents working in a store's codebase. The `next`, `react`, and `server` guides cover every package.

  - `@pepreviewpro/cli`: every doc, help line, and message runs it as `npx @pepreviewpro/cli`, the package's own name. `init` offers to add a marked PepReviewPro block to the project's `AGENTS.md`, and to `CLAUDE.md` when there is one, pointing agents at the installed packages' guides. Running it again updates the block in place. `--no-agents` skips the step, and `--yes` answers every question for scripts and agents.
  - Every package names its repository, `github.com/pepreviewpro/pepreviewpro-sdk`, and a help-center page as its homepage, and is published with npm provenance.
