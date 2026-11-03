## The rest of the SDK

This file covers one package. The guide to every package, with the step-by-step recipes for orders, imports, the catalog, server-rendered reviews, JSON-LD, webhooks, and the review form, ships inside the other packages. Read the first of these that exists:

1. `node_modules/@pepreviewpro/next/AGENTS.md`
2. `node_modules/@pepreviewpro/react/AGENTS.md`
3. `node_modules/@pepreviewpro/server/AGENTS.md`

Three rules apply everywhere. The key is secret and server only, even an old `pk_live_` one. `@pepreviewpro/server` never goes in browser code. Past orders go through `orders.import`, which sends no email. Finish with `npx @pepreviewpro/cli doctor`.

Help center: https://pepreviewpro.com/help/connect-a-store-without-wordpress. Questions: support@pepreviewpro.com.
