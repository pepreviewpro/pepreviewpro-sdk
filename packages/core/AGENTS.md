# @pepreviewpro/core: a guide for coding agents

You are working in a store's codebase that has `@pepreviewpro/core`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code.

## Do you need this package directly?

Almost never. `@pepreviewpro/core` is the typed HTTP client that `@pepreviewpro/server`, `@pepreviewpro/react`, and `@pepreviewpro/next` build on. Write store code against those. Reach for core only to:

- read public data without the server package, with `new PepReviewProClient().widgetData({ site_id })`;
- print JSON-LD with `productJsonLd` and `serializeJsonLd`;
- read the stable `code` of an API error, from `API_ERROR_CODES`.

A directory partner, which lists stores rather than running one, reads the directory through `new PepReviewProPartner()` in `@pepreviewpro/server` instead, which maps the wire to camelCase and builds the tracked links.

## Rules

- Field names are the API's own snake_case: `site_id` on public reads, `store` (the slug) on keyed calls, `line_items`, `product_ref`. The server package's camelCase options are mapped for you, so prefer it.
- Never pass `apiKey` to a `PepReviewProClient` that runs in a browser. Keyed calls (`orders`, `catalog`, `myReviews`, `heartbeat`) belong on the server, through `@pepreviewpro/server`.
- `orders` with `import: true` is a backfill and sends no email. Without it, completed orders queue review requests.
- Branch on `PepReviewProApiError.code`, never on the message. Quote `requestId` to support.
- Lists answer a page and a `next_cursor`. Send it back as `cursor`, with the same other parameters, until it is `null`.
- Escape JSON-LD with `serializeJsonLd`, never with `JSON.stringify` alone.

## The rest of the SDK

This file covers one package. The guide to every package, with the step-by-step recipes for orders, imports, the catalog, server-rendered reviews, JSON-LD, webhooks, and the review form, ships inside the other packages. Read the first of these that exists:

1. `node_modules/@pepreviewpro/next/AGENTS.md`
2. `node_modules/@pepreviewpro/react/AGENTS.md`
3. `node_modules/@pepreviewpro/server/AGENTS.md`

Three rules apply everywhere. The key is secret and server only, even an old `pk_live_` one. `@pepreviewpro/server` never goes in browser code. Past orders go through `orders.import`, which sends no email. Finish with `npx @pepreviewpro/cli doctor`.

Help center: https://pepreviewpro.com/help/connect-a-store-without-wordpress. Questions: support@pepreviewpro.com.
