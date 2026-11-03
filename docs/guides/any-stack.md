---
title: Any other stack
---

# Any other stack

Nothing in `@pepreviewpro/react` depends on Next.js. Read the reviews on the server with `@pepreviewpro/server`, and pass them to a widget as `data`.

## Remix and React Router

Read the reviews in a loader. [`examples/remix`](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/remix) is a working app.

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

Cache the read on your side for a few minutes, and clear it from a webhook route that calls `prp.webhooks.verify`.

## Astro

Add the `@astrojs/react` integration, then read the reviews in the frontmatter. [`examples/astro`](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/astro) builds a static page with them.

```astro
---
import { Carousel, ReviewsJsonLd } from "@pepreviewpro/react";
import { PepReviewPro } from "@pepreviewpro/server";

const reviews = await new PepReviewPro({ store: "example-store" }).reviews.list({ productRef: "sku-123" });
---
<ReviewsJsonLd data={reviews} product={{ name: "BPC-157 10mg", url: "https://store.example/products/sku-123" }} />
<Carousel client:visible data={reviews} />
```

A static build shows the reviews from build time. Rebuild from a webhook, or use server output.

## A server on its own

Send each order when your payment provider says it is paid. [`examples/express-stripe`](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/express-stripe) maps Stripe's `checkout.session.completed` to `orders.upsert`, with the buyer's context carried in the session's metadata. There is no adapter package to install: the mapping is about forty lines.

## Plain HTML

[`examples/vanilla`](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/vanilla) needs no build. It reads your public reviews and hands them to the widget runtime with one script tag. Search engines see reviews rendered on the server only, so use the server package for product pages.
