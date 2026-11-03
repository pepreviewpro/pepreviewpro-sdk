---
title: Next.js, end to end
---

# Next.js, end to end

A Next.js store connected in five steps: the key, your reviews on the page, the webhook route, attribution, and orders from checkout. [`examples/next-app-router`](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/next-app-router) is all of it in one app.

## 1. Install and set up

```sh
npm install @pepreviewpro/next @pepreviewpro/react @pepreviewpro/server
npx @pepreviewpro/cli init
```

`init` checks your key and writes `PEPREVIEWPRO_API_KEY` and `PEPREVIEWPRO_STORE` to `.env.local`. Set the same values in your host's server environment.

## 2. Show your reviews

Wrap the app in the provider once, in `app/layout.tsx`:

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

Read the reviews on the server and hand them to a widget, so they are in the HTML:

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

With `cacheComponents: true` in `next.config`, import `getReviews` and `ReviewsJsonLd` from `@pepreviewpro/next/cache-components` instead.

## 3. Refresh when a review changes

```ts
// app/api/pepreviewpro/route.ts
export { POST } from "@pepreviewpro/next/webhooks";
```

Save the route's URL as a webhook endpoint in the dashboard, and set `PEPREVIEWPRO_WEBHOOK_SECRET` to the secret it shows once. Check it:

```sh
npx @pepreviewpro/cli webhooks test http://localhost:3000/api/pepreviewpro
```

## 4. Get credit for the buyers PepReviewPro sends you

```ts
// proxy.ts, or middleware.ts exporting `middleware` on Next.js 15
import { withPepReviewPro } from "@pepreviewpro/next/proxy";

export const proxy = withPepReviewPro();

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
```

The provider records the same first touch in the browser, so either one is enough. Both together miss nothing.

## 5. Send orders from checkout

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

`saveOrder` stands for your own checkout. Send the order again when its status changes. A review request goes out when it reaches your store's trigger status, `completed` unless you chose `paid`. Import your past orders once with `npx @pepreviewpro/cli import-orders`, which sends no email. Run `npx @pepreviewpro/cli doctor` when you are done.
