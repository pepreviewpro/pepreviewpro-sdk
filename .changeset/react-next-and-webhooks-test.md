---
"@pepreviewpro/react": minor
"@pepreviewpro/next": minor
"@pepreviewpro/core": minor
"@pepreviewpro/server": minor
"@pepreviewpro/browser": minor
"@pepreviewpro/cli": minor
---

Add `@pepreviewpro/react` and `@pepreviewpro/next`, and `pepreviewpro webhooks test`.

- `@pepreviewpro/react`: one component per dashboard widget, named as the dashboard names it (`<Carousel>`, `<ReviewWall>`, `<TrustBadge>`, `<FloatingBadge>`, `<ProductStars>`, `<SidebarPanel>`, `<ReviewTicker>`, `<TrustSeal>`), drawn by the widget runtime with a plain HTML copy for crawlers; an accessible `<ReviewForm>` that sends the store's own product and order ids; `useReviews`, `useAggregate`, `useStoreProfile`, `useSubmitReview`; server-rendered `<Stars>`, `<ReviewList>`, `<VerifiedBadge>`, `<ReviewsJsonLd>`; and `<PepReviewProProvider>`, which records attribution.
- `@pepreviewpro/next`: `getReviews` and `getAggregate` cached with `unstable_cache`, or with `"use cache"` from `@pepreviewpro/next/cache-components`; `<ReviewsJsonLd>`; the webhook route `@pepreviewpro/next/webhooks` (`POST`, `createWebhookHandler`); `withPepReviewPro` from `@pepreviewpro/next/proxy`; `checkoutContext`; `cacheTags`.
- `@pepreviewpro/server`: `signWebhook`, and `PEPREVIEWPRO_BASE_URL` as the default `baseUrl`. `jsonLd.product` no longer throws for a store that has not saved widget settings.
- `@pepreviewpro/browser`: `attributionFromLanding` and `serializeCookie`, the rules `captureAttribution` uses, for server code.
- `@pepreviewpro/core`: `refQuery` and the `WidgetData` type.

How the API answers:

- `WidgetDataResponse.settings` is `WidgetSettings | null`. It is null until the store saves its widget settings.
- `product_ref` and `order_ref` on reviews are `string | null`, even for ids sent as numbers. `order_ref` is always null on public `widget-data`.
- `isNumericId` is false for integers of 9,000,000,000,000 or more, which the API maps like strings. Such product ids are sent as `product_ref`.
