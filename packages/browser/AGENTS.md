# @pepreviewpro/browser: a guide for coding agents

You are working in a store's codebase that uses `@pepreviewpro/browser`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code.

## What this package does

It writes two first-party cookies on the store's own site and sends nothing anywhere. It has no dependencies and takes no key.

- `captureAttribution()` records where the shopper first came from in `prp_attribution`, for 30 days. Call it once on every page load. On React, `PepReviewProProvider` already calls it.
- `trackReviewsSeen(element)` sets `prp_reviews_seen` once half of `element` is on screen. Call it only for an element that shows the store's reviews. The React widgets already call it.
- `readCheckoutContext()` returns both, for a checkout request that goes to another domain.

At checkout, `@pepreviewpro/server` reads both cookies from the request, so on the same site there is nothing else to wire. Pass the checkout request to `orders.upsert(order, { request })`.

## Rules

- Never add a PepReviewPro key to browser code. This package never needs one.
- Call `captureAttribution` on every page, not only the home page. The first touch is never overwritten, so calling it often is safe.
- Respect consent: pass `consent: () => yourBanner.allows("analytics")`. Global Privacy Control turns tracking off whatever `consent` says.
- When pages and checkout are on different subdomains, pass `cookieDomain: ".example.com"` to both calls.

## The rest of the SDK

This file covers one package. The guide to every package, with the step-by-step recipes for orders, imports, the catalog, server-rendered reviews, JSON-LD, webhooks, and the review form, ships inside the other packages. Read the first of these that exists:

1. `node_modules/@pepreviewpro/next/AGENTS.md`
2. `node_modules/@pepreviewpro/react/AGENTS.md`
3. `node_modules/@pepreviewpro/server/AGENTS.md`

Three rules apply everywhere. The key is secret and server only, even an old `pk_live_` one. `@pepreviewpro/server` never goes in browser code. Past orders go through `orders.import`, which sends no email. Finish with `npx @pepreviewpro/cli doctor`.

Help center: https://pepreviewpro.com/help/connect-a-store-without-wordpress. Questions: support@pepreviewpro.com.
