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
