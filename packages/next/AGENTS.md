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

## The whole SDK, for a store's codebase

PepReviewPro collects verified reviews from a store's buyers. The store sends its orders. PepReviewPro emails each buyer a review request, matches each review to its order, and gives the store widgets and data to show the reviews. The SDK connects a store on any stack. This guide covers every package, so read it once before you plan the work.

### Which packages to install

Read the project's `package.json` and framework config first, then pick one row.

| The project is                                                    | Install                                                                    | Notes                                                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 15 or 16 with the App Router                              | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`          | Pick the `@pepreviewpro/next` entry by `cacheComponents`. See the rules below.                                                   |
| Next.js with the Pages Router only                                | `@pepreviewpro/react` `@pepreviewpro/server`                               | Read reviews in `getServerSideProps` or `getStaticProps`. `getReviews` and the webhook route rely on the App Router's cache.     |
| React on Remix, React Router 7 or later, TanStack Start, Vite     | `@pepreviewpro/react` `@pepreviewpro/server`                               | Read reviews in a loader with `prp.reviews.list`, then pass them to a widget as `data`.                                          |
| Astro                                                             | `@pepreviewpro/react` `@pepreviewpro/server`                               | Add `@astrojs/react`. Read reviews in the frontmatter. Render widgets as islands with `client:visible`.                          |
| Pages you render yourself, no React                               | `@pepreviewpro/browser` on the pages, `@pepreviewpro/server` on the server | Print reviews from `prp.reviews.list` in your own HTML.                                                                          |
| Plain HTML with no build                                          | Nothing on the page. `@pepreviewpro/server` wherever orders are placed     | The widget script tag in the dashboard's gallery shows reviews. Orders still need a server.                                      |
| A backend only: an API, a worker, a payment webhook               | `@pepreviewpro/server`                                                     | Orders, imports, catalog, and webhooks. No UI.                                                                                   |
| A directory, a comparison site, or an assistant that lists stores | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next`    | Not a store. Follow "Directory partners, every package" in `node_modules/@pepreviewpro/server/AGENTS.md`, not the recipes below. |

`@pepreviewpro/cli` is run with `npx @pepreviewpro/cli`, not imported. `@pepreviewpro/core` is the HTTP client the others build on. A store rarely installs it directly.

Install with the project's own package manager. Look for `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, or `package-lock.json`.

### Rules that matter most

1. **The key is secret and server only.** A store key is `sk_live_` and 40 letters and digits. Older keys start with `pk_live_`. Despite the prefix, they are just as secret: no PepReviewPro key is publishable. Read it from `PEPREVIEWPRO_API_KEY` on the server. Never give it a `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` name, never pass it to a component, and never commit it.
2. **Only `@pepreviewpro/server` takes a key, and it never runs in a browser.** Never import `@pepreviewpro/server` or `@pepreviewpro/next` in a file marked `"use client"`, in a component a client component imports, or in browser code. In a browser bundle, `@pepreviewpro/server` throws on import. Widgets and hooks come from `@pepreviewpro/react`, which takes no key.
3. **Backfills never email.** Send past orders with `prp.orders.import(orders)` and no `sendEmail`. That sends them as an import, `import: true` on the wire, so no review request goes out. Never loop `orders.upsert` over old orders: it is the live checkout path, and it can email every past buyer at once. `sendEmail: true` is only for the daily re-send of the last 48 hours.
4. **A webhook is a reason to refetch, not data to cache.** Deliveries repeat and arrive out of order. On Next.js, the shipped route revalidates the cache tags and nothing else. On other stacks, clear your cache and read again. Drop repeats by `event.id`. Pass the raw body to `webhooks.verify`, `await request.text()`, never parsed JSON.
5. **Pick the `@pepreviewpro/next` entry by `cacheComponents`.** When `next.config` sets `cacheComponents: true`, import `getReviews`, `getAggregate`, and `ReviewsJsonLd` from `@pepreviewpro/next/cache-components`. Otherwise, and always on Next.js 15, import them from `@pepreviewpro/next`. The `cache-components` entry uses `"use cache"`, and an app without Cache Components fails its build on it.
6. **Ids are the store's own, and may be strings.** Order ids like `ORD-1001` and product ids like `sku-123` are fine as they are. Never `Number()` or `parseInt` them, and never invent new ones. Use the same product id in line items, the catalog, `productRef`, and the review form, or reviews will not line up with products. `store` is the store's slug, like `example-store`, never a UUID.
7. **Send an order again when its status changes.** `orders.upsert` creates or updates by id, so a repeat is safe. A review request is queued when the order reaches the store's trigger status, `completed` unless the store chose `paid` in the dashboard under **Widgets**, **Integrations**, **Request reviews when an order is**. A store that sends `paid` with the default setting gets no review requests, so match the two. `refunded` or `cancelled` stops a request that has not gone out yet.
8. **Finish with `npx @pepreviewpro/cli doctor`.** It checks the key, the store, the installed packages, the webhook secret, and scans the client build for a leaked key. It exits 1 on a failure.

### Environment variables

Set them in the server environment of every deployment, and in `.env.local` for development. `npx @pepreviewpro/cli init` writes the first two to `.env.local` after a yes.

| Name                          | Secret | Read by                                                        | Value                                                                          |
| ----------------------------- | ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PEPREVIEWPRO_API_KEY`        | yes    | `@pepreviewpro/server`, the CLI                                | The store key, `sk_live_...`. Server only.                                     |
| `PEPREVIEWPRO_STORE`          | no     | `@pepreviewpro/next`, the CLI                                  | The store's slug. Pass it to `new PepReviewPro({ store })` yourself.           |
| `PEPREVIEWPRO_WEBHOOK_SECRET` | yes    | `@pepreviewpro/server`, `@pepreviewpro/next/webhooks`, the CLI | The endpoint's `whsec_...` secret, shown once when the endpoint is saved.      |
| `PEPREVIEWPRO_BASE_URL`       | no     | `@pepreviewpro/server`, the CLI                                | Leave unset. Points the SDK at a server other than `https://pepreviewpro.com`. |

The store key comes from the PepReviewPro dashboard: **Widgets**, then **Integrations**, the **Next.js** or **React** tab, **Store key**, **Create key**. It is shown once. If you cannot get it, ask the person you work for. Never make one up, and never paste a real key into code, tests, or docs.

### Connect and verify

```sh
npx @pepreviewpro/cli init
npx @pepreviewpro/cli doctor
```

`init` asks for the key and the slug, checks them with PepReviewPro, and offers to write `.env.local`. With no terminal, set `PEPREVIEWPRO_API_KEY` in the environment and run `npx @pepreviewpro/cli init --store example-store --yes`. Check that `.gitignore` covers `.env.local`.

### Send orders from checkout

Call `orders.upsert` on the server, where the order is saved, and pass the checkout request. The SDK reads the buyer's attribution and reviews-seen cookies, IP address, and user agent from it. They are what credit the order in the store's **Insights**.

In a route handler on any Fetch-based stack:

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function POST(request: Request) {
	const order = await saveOrder(await request.json());
	await prp.orders.upsert(
		{
			id: order.number,
			status: "paid",
			email: order.email,
			name: order.name,
			total: order.total,
			currency: order.currency,
			createdAt: order.createdAt,
			lineItems: order.items.map((item) => ({ productId: item.sku, name: item.title, quantity: item.quantity, total: item.total }))
		},
		{ request }
	);
	return Response.json({ ok: true });
}
```

In a Next.js server action, spread `checkoutContext(await headers())` into the order instead:

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

Express and Node requests work too: `{ request: req }` reads `req.headers`. When checkout runs on another domain than the pages, send `readCheckoutContext()` from `@pepreviewpro/browser` with the checkout request and pass it as `{ context }`.

Without `email` and `lineItems`, no review request can go out. Send the order again on every status change, with the same `id`.

### Import past orders, without email

Run it once, after connecting. From a file:

```sh
npx @pepreviewpro/cli import-orders orders.csv
```

It takes CSV with one row per line item, or JSON, and resumes where it stopped. From code:

```ts
import { ImportError, PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

try {
	const totals = await prp.orders.import(allPastOrders(), {
		checkpoint: await loadCheckpoint(),
		onProgress: (progress) => saveCheckpoint(progress.checkpoint)
	});
	console.log(`${totals.created} new, ${totals.updated} updated, ${totals.unchanged} unchanged`);
} catch (error) {
	if (error instanceof ImportError) {
		await saveCheckpoint(error.checkpoint);
	}

	throw error;
}
```

Never pass `sendEmail` here.

### Re-send recent orders each day

Checkout calls miss orders when either side is down. A daily job that sends the last 48 hours again, with email on, catches them. Orders PepReviewPro has come back `unchanged`. Protect the route the way the project protects its other scheduled jobs.

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function GET() {
	const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
	const totals = await prp.orders.import(ordersUpdatedSince(since), { sendEmail: true });
	return Response.json(totals);
}
```

Without code: `my-store-export --since 48h --format json | npx @pepreviewpro/cli sync-orders --since 48h`. It leaves out orders with no date, so a full export never mails old buyers.

### Push the catalog

Send the whole catalog every time, up to 5,000 products. Leave out `shipsTo`, `shipsFrom`, or `paymentMethods` to keep what PepReviewPro has.

```ts
import { PepReviewPro } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

await prp.catalog.push({
	products: await allProducts(),
	shipsTo: ["US", "CA"],
	shipsFrom: "US",
	paymentMethods: ["card", "crypto"]
});
```

Payment methods are `card`, `crypto`, `bankTransfer`, `zelle`, `cashApp`, `venmo`, `paypal`, and `other`. `npx @pepreviewpro/cli push-catalog catalog.json` sends a file.

### Show reviews, rendered on the server

Wrap the app once in the provider. It sets the store for every widget and records where each shopper came from. In Next.js, put it in `app/layout.tsx`. It is a client component, so a Server Component layout can render it.

```tsx
import { PepReviewProProvider } from "@pepreviewpro/react";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<PepReviewProProvider store={process.env.PEPREVIEWPRO_STORE}>{children}</PepReviewProProvider>
			</body>
		</html>
	);
}
```

Then read the reviews on the server and pass them as `data`, so they are in the HTML. On Next.js:

```tsx
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

`getReviews` reads the store from `PEPREVIEWPRO_STORE`, caches for an hour, and tags the entry for the webhook route. Here the product's slug is its id. Use whatever id the store sends in line items.

On Remix or React Router:

```tsx
import { Carousel } from "@pepreviewpro/react";
import { PepReviewPro } from "@pepreviewpro/server";
import { useLoaderData } from "react-router";

const prp = new PepReviewPro({ store: "example-store" });

export async function loader() {
	return { reviews: await prp.reviews.list({ productRef: "sku-123" }) };
}

export default function Product() {
	const { reviews } = useLoaderData<typeof loader>();
	return <Carousel data={reviews} />;
}
```

`prp.reviews.list` reads public data, so page renders never count against the key. Outside Next.js, cache it on your side for a few minutes.

The widgets are `Carousel`, `ReviewWall`, `TrustBadge`, `FloatingBadge`, `ProductStars`, `SidebarPanel`, `ReviewTicker`, and `TrustSeal`. Each takes `data` or `productRef`, plus `theme`, `limit`, `cols`, `minRating`, `link`, `align`, and `className`. Widgets that list reviews, and `useReviews`, skip reviews with stars but no text; the rating still counts them. For a design of your own, use `useReviews` and `useAggregate` with the unstyled `Stars`, `ReviewList`, and `VerifiedBadge`.

### Product JSON-LD

Print it on product pages from the same `data` the widget shows, so the markup and the visible rating agree. It prints nothing for a product with no reviews.

- Next.js: `<ReviewsJsonLd data={reviews} product={{ name, url }} />` from the `@pepreviewpro/next` entry you chose.
- Other React: `<ReviewsJsonLd data={reviews} product={{ name, url }} />` from `@pepreviewpro/react`.
- Anything else: `serializeJsonLd(await prp.jsonLd.product({ name, url, productRef }))` inside `<script type="application/ld+json">`. `serializeJsonLd` is in `@pepreviewpro/core`, and it escapes the markup so a review cannot close the tag.

Pass `offers` with the page's own Offer nodes, so the page carries one Product. There is no Organization markup on purpose: Google shows no stars for reviews a business hosts about itself.

### The webhook route and cache tags

On Next.js, the route is one line:

```ts
// app/api/pepreviewpro/route.ts
export { POST } from "@pepreviewpro/next/webhooks";
```

It checks the Standard Webhooks signature with `PEPREVIEWPRO_WEBHOOK_SECRET`, revalidates the tags the event changed, and answers 200. A bad signature gets a 401. The tags are `pepreviewpro:<store>` for every event, and `pepreviewpro:<store>:product:<productRef>` for `review.published` and `review.updated`. `cacheTags(store, productRef)` returns them, for a `"use cache"` function of your own.

Elsewhere, verify and clear your own cache:

```ts
import { PepReviewPro, WebhookVerificationError } from "@pepreviewpro/server";

const prp = new PepReviewPro({ store: process.env.PEPREVIEWPRO_STORE! });

export async function POST(request: Request) {
	try {
		const event = await prp.webhooks.verify(await request.text(), request.headers);
		if (event.type !== "ping") {
			await clearReviewCache(event.data.store);
		}

		return Response.json({ received: true });
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			return Response.json({ error: error.message }, { status: 401 });
		}

		throw error;
	}
}
```

The person you work for saves the route's public URL in the dashboard, under **Integrations**, **Webhooks**, and copies the secret it shows once into `PEPREVIEWPRO_WEBHOOK_SECRET`. Test the route locally:

```sh
npx @pepreviewpro/cli webhooks test http://localhost:3000/api/pepreviewpro --secret whsec_...
```

### Attribution

The provider records the shopper's first touch in the browser. On Next.js, the proxy records it on the first request too, so a visit that never runs JavaScript still counts. In Next.js 16, put this in `proxy.ts`:

```ts
import { withPepReviewPro } from "@pepreviewpro/next/proxy";

export const proxy = withPepReviewPro();

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
```

On Next.js 15 the file is `middleware.ts` and the export is `middleware`. If the project already has a proxy, wrap it: `withPepReviewPro(existingProxy)`. Without React, call `captureAttribution()` from `@pepreviewpro/browser` on every page load, and `trackReviewsSeen(element)` on any element that shows reviews. Nothing is written under Global Privacy Control. Pass `consent` to wait for a cookie banner.

### The review form

```tsx
"use client";
import { ReviewForm } from "@pepreviewpro/react";

export function WriteReview({ productId, orderId }: { productId: string; orderId?: string }) {
	return <ReviewForm productRef={productId} orderRef={orderId} />;
}
```

It sends the store's own product and order ids, so the review matches its order. The review waits until its author confirms it by email. The form is unstyled. Style it by its `data-prp-*` attributes, and keep its labels and alerts.

### Tell the Connection card what the store does

The server package checks in with the dashboard once a day after its first call that works. Declare what the store uses so the **Connection** card is complete:

```ts
import { PepReviewPro } from "@pepreviewpro/server";

export const prp = new PepReviewPro({
	store: process.env.PEPREVIEWPRO_STORE!,
	heartbeat: { capabilities: ["orders", "attribution", "reviewsSeen", "catalog", "webhooks", "jsonLd"] }
});
```

List only what you built. Without `attribution`, the card warns that **Insights** will undercount. On serverless hosts, pass `waitUntil` so the check-in can finish.

### Verify your work

- [ ] `npx @pepreviewpro/cli doctor` exits 0. Run it again after `npm run build` so it scans the client bundle.
- [ ] No file with `"use client"`, and nothing it imports, imports `@pepreviewpro/server` or `@pepreviewpro/next`.
- [ ] The key appears only as `process.env.PEPREVIEWPRO_API_KEY` in server code. No `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` name holds it.
- [ ] Checkout calls `orders.upsert` with `{ request }` or `checkoutContext(...)`, sends `email` and `lineItems`, and runs again on status changes.
- [ ] The status checkout sends matches the store's **Request reviews when an order is** setting: `completed` for the default, or `paid` if the store switched it.
- [ ] Past orders go through `orders.import` or `import-orders`, never through `orders.upsert` in a loop, and never with `sendEmail`.
- [ ] Product ids are the same strings or numbers everywhere: line items, catalog, `productRef`, the form.
- [ ] On Next.js, every `getReviews`, `getAggregate`, and `ReviewsJsonLd` comes from the entry that matches `cacheComponents`.
- [ ] The product page's HTML, fetched with `curl`, contains review text and one `application/ld+json` Product.
- [ ] `npx @pepreviewpro/cli webhooks test <url>` gets a 2xx from the webhook route.
- [ ] The project's own typecheck, lint, and tests pass.

### More

- Help center: https://pepreviewpro.com/help/connect-a-store-without-wordpress
- Every package's README is in `node_modules/@pepreviewpro/<name>/README.md`, and its types are in `dist/*.d.ts`.
- Working examples: https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples
- Questions for PepReviewPro: support@pepreviewpro.com

## Directory partners, every package

A directory partner lists PepReviewPro stores to its own users: a comparison site, a review roundup, or a chat assistant. PepReviewPro collects verified reviews from each store's buyers, and partners show the stores and their ratings. Every link a partner sends through PepReviewPro tells the store the visit came from that partner. Read this once before you plan the work.

### Which packages to install

| The project is                          | Install                                     | Notes                                                                               |
| --------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| A chat assistant on the AI SDK          | `@pepreviewpro/ai` `@pepreviewpro/server`   | `createFindVendorsTool(partner)` is the whole integration.                          |
| A directory or comparison site, Next.js | `@pepreviewpro/next` `@pepreviewpro/server` | `getDirectoryStores` and friends cache the reads. See the caching rule below.       |
| A directory on any other server         | `@pepreviewpro/server`                      | `new PepReviewProPartner()` and its `stores.list`, `products.list`, `reviews.list`. |

A partner never needs `@pepreviewpro/react`, `@pepreviewpro/browser`, or `@pepreviewpro/cli`, which are for a store's own site.

### Rules that matter most

1. **The key is secret and server only.** A partner key starts with `pk_live_`. Despite the prefix, it is as secret as any key. Read it from `PEPREVIEWPRO_API_KEY` on the server. Never give it a `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` name, and never commit it. If you cannot get it, ask the person you work for. It comes from the PepReviewPro dashboard, under **API**, **Keys**, with **Read the vendor directory** (`stores:read`), and `partner:write` for reports.
2. **Link `clickUrl` and `profileUrl`, never the raw ones.** `clickUrl` goes to the store or product through PepReviewPro, and `profileUrl` to the store's PepReviewPro page with the partner's name on it. `websiteUrl` and `pageUrl` are untracked: a visit through them earns no credit. On a key not yet linked to a partner, `clickUrl` is `null`. To land on a page of your own choosing on the store's site, use `partner.links.click(store, { to })`.
3. **A store is named by its `slug`,** like `example-store`, and a product by its `ref`. Use them for `store` and `productRef` in events, and `store` in reviews. Show `rating`, the average stars. `score` ranks the directory and is not a star rating.
4. **Ask for a compound with `compound`, a country with `shipsTo`, and a name with `search`.** `search` only matches store names. With `compound`, `stores.list` returns each store's `matchedProducts`, so there is no need to group `products.list` by store.
5. **An empty answer is an answer.** The API never drops a filter to fill a list, and an unknown compound matches nothing. Say so, or relax the filters yourself and say which. The AI tool does both.
6. **Report what you show.** Your reads count as your impressions until your first `shown` event; from then on only `shown` events do. A page served from a cache never reaches the API, so report what every page shows: `partner.events.report([{ id, type: "shown", store, placement: "finderStore" }], { background: true })`.
7. **Lists are pages.** Each has `nextCursor`; pass it back as `cursor`, or loop over `partner.stores.iterate(options)`. `limit` is 1 to 100.
8. **Never retry a report yourself.** `vendorMiss.report` and `events.report` are counted on arrival. The SDK retries them with the same `Idempotency-Key`, so its retries count once; a retry of your own is a new call. Give each event an `id` of your own, like the page view's id and the store's slug, and a resent event counts once.

### A directory page on Next.js

```tsx
import { getDirectoryStores } from "@pepreviewpro/next";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { after } from "next/server";

const partner = new PepReviewProPartner();

export default async function VendorsPage() {
	const { stores } = await getDirectoryStores({ compound: "bpc-157", sort: "best", limit: 12 });
	after(() =>
		partner.events.report(
			stores.map((store) => ({ type: "shown" as const, store: store.slug, compound: "bpc-157", placement: "finderStore" as const }))
		)
	);
	return (
		<main id="main-content">
			<h1>Where to buy BPC-157</h1>
			<ul>
				{stores.map((store) => (
					<li key={store.slug}>
						<a href={store.clickUrl ?? store.profileUrl}>{store.name}</a> is rated {store.rating.toFixed(1)} from {store.reviewCount} reviews.{" "}
						<a href={store.profileUrl}>Read the reviews</a>
					</li>
				))}
			</ul>
		</main>
	);
}
```

With `cacheComponents: true`, import `getDirectoryStores`, `getDirectoryProducts`, and `getDirectoryReviews` from `@pepreviewpro/next/cache-components` instead. Both cache for five minutes under the tag `pepreviewpro:directory`.

### A store your user asked about

When a user names a store you cannot show, report it, so PepReviewPro can invite the store. The SDK trims the name to 120 characters and the question to 200.

```ts
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

partner.vendorMiss.report({ name: "Juniper Store", question: "Is Juniper Store reviewed anywhere?" }, { background: true });
```

### Verify your work

- [ ] The key appears only as `process.env.PEPREVIEWPRO_API_KEY` in server code.
- [ ] Every store and product link in the HTML or in the assistant's answers starts with `https://pepreviewpro.com/go/` or `https://pepreviewpro.com/vendors/`.
- [ ] Every page reports `shown` events for the stores it shows, cached or not.
- [ ] Nothing retries `vendorMiss.report` or `events.report` in a loop of its own.
- [ ] The project's own typecheck, lint, and tests pass.

### More

- Help center: https://pepreviewpro.com/help/create-an-api-key
- Every package's README is in `node_modules/@pepreviewpro/<name>/README.md`, and its types are in `dist/*.d.ts`.
- Working example: https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/partner-next
- Questions for PepReviewPro: support@pepreviewpro.com
