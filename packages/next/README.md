# @pepreviewpro/next

[![npm](https://img.shields.io/npm/v/@pepreviewpro/next)](https://www.npmjs.com/package/@pepreviewpro/next) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

PepReviewPro for the Next.js App Router: cached reviews in your HTML, Product JSON-LD, the webhook route, and attribution.

Your reviews render on the server and stay cached. A webhook refreshes them the moment a review changes. The proxy records where each shopper came from on the first request, and `checkoutContext` carries it to your orders.

## Which package do I need?

| Your stack                                   | Install                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`       |
| Next.js, Pages Router only                   | `@pepreviewpro/react` `@pepreviewpro/server`                            |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                            |
| A server with no React                       | `@pepreviewpro/server`, plus `@pepreviewpro/browser` on your pages      |
| A directory partner's site or assistant      | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next` |

On Next.js, install all three: this package caches and routes, `@pepreviewpro/react` draws the widgets, and `@pepreviewpro/server` sends your orders.

## Requirements

- Next.js 15 or 16 with the App Router, and React 18.2 or later, or 19.
- Node 20 or later.
- A store key from the PepReviewPro dashboard: **Widgets**, **Integrations**, the **Next.js** tab, **Store key**.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/next @pepreviewpro/react @pepreviewpro/server

# npm
npm install @pepreviewpro/next @pepreviewpro/react @pepreviewpro/server

# yarn
yarn add @pepreviewpro/next @pepreviewpro/react @pepreviewpro/server
```

Then run `npx @pepreviewpro/cli init`. It checks your key and writes the first two variables to `.env.local`.

```sh
# .env.local, and your host's server environment
PEPREVIEWPRO_API_KEY=sk_live_...        # secret, server only, never NEXT_PUBLIC_
PEPREVIEWPRO_STORE=example-store        # your store's slug
PEPREVIEWPRO_WEBHOOK_SECRET=whsec_...   # shown once when you save the webhook endpoint
```

## Quick start

Two files. First, your reviews on the product page:

```tsx
// app/products/[slug]/page.tsx
import { getReviews, ReviewsJsonLd } from "@pepreviewpro/next";
import { Carousel } from "@pepreviewpro/react";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const reviews = await getReviews({ productRef: slug });
	return (
		<main id="main-content">
			<ReviewsJsonLd data={reviews} product={{ name: "BPC-157 10mg", url: `https://store.example/products/${slug}` }} />
			<Carousel data={reviews} />
		</main>
	);
}
```

Then the webhook route that keeps them current:

```ts
// app/api/pepreviewpro/route.ts
export { POST } from "@pepreviewpro/next/webhooks";
```

Save `https://store.example/api/pepreviewpro` as the webhook endpoint in the dashboard. Check it with `npx @pepreviewpro/cli webhooks test http://localhost:3000/api/pepreviewpro`.

## Pick your entry

| Your `next.config`                         | Import `getReviews`, `getAggregate`, `ReviewsJsonLd` from        |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Next.js 15, or 16 without Cache Components | `@pepreviewpro/next`, cached with `unstable_cache`               |
| Next.js 16 with `cacheComponents: true`    | `@pepreviewpro/next/cache-components`, cached with `"use cache"` |

The two are separate because `"use cache"` is compiled. An app without Cache Components fails its build on any module that contains it, whether or not the function is called. Both cache for an hour and use the same tags.

## API

### `@pepreviewpro/next`

<!-- snippet: partial -->

```ts
getReviews(options?: { store?; productRef?; limit? }): Promise<WidgetData>
getAggregate(options?: { store?; productRef?; limit? }): Promise<WidgetAggregate>
<ReviewsJsonLd product={{ name, url, productRef? }} data? store? />
checkoutContext(requestOrHeaders): CheckoutFields
cacheTags(store, productRef?): string[]
```

- `getReviews` reads your public reviews, caches them for an hour, and tags them for the webhook route. `store` defaults to `PEPREVIEWPRO_STORE`, and `limit` to 20.
- `getAggregate` returns the rating from the same cached read.
- `<ReviewsJsonLd>` is an async Server Component. Pass `data` to reuse the page's read, or `product.productRef` to read it from the cache.
- `checkoutContext` returns the buyer's attribution, reviews-seen time, IP address, and user agent as order fields. It leaves out what the request does not carry, so spreading it never clears a field of your own.

### Cache tags

| Tag                                  | Refreshed by                             |
| ------------------------------------ | ---------------------------------------- |
| `pepreviewpro:<store>`               | Every event.                             |
| `pepreviewpro:<store>:product:<ref>` | `review.published` and `review.updated`. |

`cacheTags(store, productRef)` returns them, for `"use cache"` functions of your own.

### Directory reads, for partners

A directory partner lists PepReviewPro stores rather than running one. Both entries export cached versions of the partner reads, keyed on the query and tagged `pepreviewpro:directory`. They read the partner key from `PEPREVIEWPRO_API_KEY`.

<!-- snippet: partial -->

```ts
getDirectoryStores(query?): Promise<DirectoryStoresPage>
getDirectoryProducts(query): Promise<DirectoryProductsPage>
getDirectoryReviews(query?): Promise<DirectoryReviewsPage>
```

The queries and pages are those of `PepReviewProPartner` in `@pepreviewpro/server`, without `signal`. Each read is cached for five minutes. `revalidateTag(DIRECTORY_CACHE_TAG)` refetches them all.

A read served from the cache never reaches the API, so its stores are not counted as served in their insights. Report what a cached page shows as `shown` events:

```tsx
import { getDirectoryStores } from "@pepreviewpro/next";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { after } from "next/server";

const partner = new PepReviewProPartner();

export default async function VendorsPage() {
	const { stores } = await getDirectoryStores({ sort: "best", limit: 12 });
	after(() => partner.events.report(stores.map((store) => ({ type: "shown" as const, store: store.slug, placement: "finderStore" as const }))));
	return (
		<main id="main-content">
			<h1>Vendors</h1>
			<ul>
				{stores.map((store) => (
					<li key={store.slug}>
						<a href={store.clickUrl ?? store.profileUrl}>{store.name}</a>
					</li>
				))}
			</ul>
		</main>
	);
}
```

Link `clickUrl` and `profileUrl`, never `websiteUrl`: only the first two credit you. Each read is one page with `nextCursor`; pass it back as `cursor` for the next.

### `@pepreviewpro/next/webhooks`

`POST` is a whole route handler. It checks the [Standard Webhooks](https://www.standardwebhooks.com) signature, revalidates the tags the event changed, and answers 200. A bad signature gets a 401. To act on events yourself:

```ts
// app/api/pepreviewpro/route.ts
import { createWebhookHandler } from "@pepreviewpro/next/webhooks";

export const POST = createWebhookHandler({
	onEvent: async (event) => {
		if (event.type === "review.published") {
			console.log(`New review for ${event.data.product_ref ?? "the store"}`);
		}
	}
});
```

| Option    | What it does                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------- |
| `secret`  | Defaults to `PEPREVIEWPRO_WEBHOOK_SECRET`.                                                          |
| `client`  | A `PepReviewPro` to verify through, so its daily check-in reports webhooks.                         |
| `onEvent` | Runs after the cache is revalidated. If it throws, the route answers 500 and the event comes again. |
| `profile` | Next.js 16 only. Default `"max"`. `{ expire: 0 }` makes the next visit wait for fresh reviews.      |

Events can repeat, so use `event.id` to skip ones you have seen.

### `@pepreviewpro/next/proxy`

```ts
// proxy.ts on Next.js 16. On Next.js 15: middleware.ts, exporting `middleware`.
import { withPepReviewPro } from "@pepreviewpro/next/proxy";

export const proxy = withPepReviewPro();

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
```

On a page load with `prp_click_id`, a UTM tag, or a referrer from another site, it writes the `prp_attribution` cookie, by the same rules as `@pepreviewpro/browser`. A first visit that never runs JavaScript still counts. The first touch is never overwritten, and nothing is written under Global Privacy Control. To keep a proxy of your own, wrap it: `withPepReviewPro(myProxy, { consent, cookieDomain })`.

### Checkout

```ts
"use server";
import { checkoutContext } from "@pepreviewpro/next";
import { PepReviewPro } from "@pepreviewpro/server";
import { headers } from "next/headers";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function placeOrder(form: FormData) {
	const order = await saveOrder(form);
	await prp.orders.upsert({
		id: order.number,
		status: "paid",
		email: order.email,
		lineItems: order.items.map((item) => ({ productId: item.sku, name: item.title, quantity: item.quantity, total: item.total })),
		...checkoutContext(await headers())
	});
}
```

`saveOrder` stands for your own checkout code. Pass `await headers()` in a server action, or the `request` in a route handler. Send the order again when its status changes.

## Errors

- `getReviews` throws a `TypeError` when neither `store` nor `PEPREVIEWPRO_STORE` is set, and a `PepReviewProApiError` from `@pepreviewpro/server` when the API refuses the read. Wrap the widget in an error boundary, or catch and render nothing, so a review outage never takes the page down.
- The webhook route answers 401 to a bad signature, and 500 when `PEPREVIEWPRO_WEBHOOK_SECRET` is not set.
- See `@pepreviewpro/server` for the errors orders can throw.

## Security

- **The key is secret.** Only `@pepreviewpro/server` reads it, from `PEPREVIEWPRO_API_KEY`. Older keys start with `pk_`, and they are just as secret. Never use a `NEXT_PUBLIC_` name for it.
- Import this package and `@pepreviewpro/server` only from Server Components, route handlers, server actions, and the proxy. Never from a `"use client"` file.
- Reviews are read from public data, so page renders never count against the key.
- `npx @pepreviewpro/cli doctor` scans `.next/static` for a leaked key.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Connect a store that isn't on WordPress](https://pepreviewpro.com/help/connect-a-store-without-wordpress), [Keep your pages current with webhooks](https://pepreviewpro.com/help/keep-your-pages-current-with-webhooks), [Show reviews with React](https://pepreviewpro.com/help/show-reviews-with-react)
- Guide: [Next.js, end to end](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/nextjs.md)
- Example: [Next.js 16 with Cache Components](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/next-app-router)
- For AI coding agents: `node_modules/@pepreviewpro/next/AGENTS.md`, a guide to every package

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
