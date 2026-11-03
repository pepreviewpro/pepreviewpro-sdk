# @pepreviewpro/next: a guide for coding agents

You are working in a store's Next.js app that uses `@pepreviewpro/next`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code. The second half covers every PepReviewPro package, so you need no other guide.

## What this package gives a Next.js app

| Import                                | Use it in                                         | For                                                                                                          |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@pepreviewpro/next`                  | Server Components, route handlers, server actions | `getReviews`, `getAggregate`, `ReviewsJsonLd`, `checkoutContext`, `cacheTags`, cached with `unstable_cache`. |
| `@pepreviewpro/next/cache-components` | Server Components, with `cacheComponents: true`   | The same exports, cached with `"use cache"` and `cacheLife("hours")`.                                        |
| `@pepreviewpro/next/webhooks`         | `app/api/pepreviewpro/route.ts`                   | `POST`, the whole webhook route, and `createWebhookHandler` to add `onEvent`.                                |
| `@pepreviewpro/next/proxy`            | `proxy.ts`, or `middleware.ts` on Next.js 15      | `withPepReviewPro`, which records attribution on the first request.                                          |

None of these run in the browser. The widgets and the form come from `@pepreviewpro/react`, and orders go through `@pepreviewpro/server`.

For a directory partner, both entries also export `getDirectoryStores`, `getDirectoryProducts`, and `getDirectoryReviews`: the partner reads, cached for five minutes under the tag `pepreviewpro:directory`. The partner guide at the end of this file covers them.

## Before you start

1. Read `next.config.*`. If it sets `cacheComponents: true`, every `getReviews`, `getAggregate`, and `ReviewsJsonLd` import comes from `@pepreviewpro/next/cache-components`. Otherwise it comes from `@pepreviewpro/next`. Never mix the two in one app.
2. Read the `next` version in `package.json`. On 16, attribution goes in `proxy.ts` as `export const proxy`. On 15, it goes in `middleware.ts` as `export const middleware`. If the file exists already, wrap the existing function with `withPepReviewPro(existing)` instead of replacing it.
3. Find where the app saves an order. That is where `orders.upsert` goes. If checkout is a server action, use `checkoutContext(await headers())`. If it is a route handler, pass `{ request }`.

## The files a typical setup touches

- `app/layout.tsx`: wrap `children` in `<PepReviewProProvider store={process.env.PEPREVIEWPRO_STORE}>`.
- `app/products/[slug]/page.tsx`, or the product route: `getReviews`, `<ReviewsJsonLd>`, and a widget.
- `app/api/pepreviewpro/route.ts`: `export { POST } from "@pepreviewpro/next/webhooks";`.
- `proxy.ts` or `middleware.ts`: `withPepReviewPro()`.
- The checkout action or route: `prp.orders.upsert(...)`.
- `.env.local` and the host's environment: `PEPREVIEWPRO_API_KEY`, `PEPREVIEWPRO_STORE`, `PEPREVIEWPRO_WEBHOOK_SECRET`.

## Webhook route details

`createWebhookHandler({ onEvent })` runs `onEvent` after the cache is revalidated. If `onEvent` throws, the route answers 500 and PepReviewPro delivers the event again. On Next.js 16, the route calls `revalidateTag(tag, "max")`, so the next visit gets the cached page while it refreshes. Pass `profile: { expire: 0 }` to make the next visit wait for fresh reviews. With no `PEPREVIEWPRO_WEBHOOK_SECRET`, the route answers 500 and says so.
