# @pepreviewpro/react

[![npm](https://img.shields.io/npm/v/@pepreviewpro/react)](https://www.npmjs.com/package/@pepreviewpro/react) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

Your PepReviewPro reviews in React 18 and 19: the dashboard's widgets, the review form, and headless hooks.

Every widget in your PepReviewPro dashboard is a component here, and it looks the same as on WordPress. The package reads only public data by your store's slug, so it takes no key. Read your reviews on the server and pass them in, and they are in your HTML for search engines.

## Which package do I need?

| Your stack                                   | Install                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`        |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                             |
| React in the browser only                    | `@pepreviewpro/react`. Orders still need `@pepreviewpro/server`.         |
| Pages you render yourself, no React          | `@pepreviewpro/browser` on the pages, `@pepreviewpro/server` at checkout |
| A directory partner's site or assistant      | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next`  |

`@pepreviewpro/server` reads your reviews on the server and sends your orders. This package shows the reviews.

## Requirements

- React 18.2 or later, or React 19, and the matching `react-dom`.
- The widgets load the PepReviewPro widget runtime from `https://pepreviewpro.com/embed/widgets.js`. If your site sends a Content Security Policy, allow that script.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/react

# npm
npm install @pepreviewpro/react

# yarn
yarn add @pepreviewpro/react
```

## Quick start

Wrap your app once, then place a widget.

```tsx
import { Carousel, PepReviewProProvider } from "@pepreviewpro/react";

export function App() {
	return (
		<PepReviewProProvider store="example-store" theme="auto">
			<Carousel productRef="sku-123" />
		</PepReviewProProvider>
	);
}
```

The provider sets the store and theme for every widget inside it, and records where each shopper came from.

### Reviews in your HTML

Pass `data` read on the server, and the widget skips its browser fetch. Here in a React Router loader:

```tsx
import { Carousel, ReviewsJsonLd } from "@pepreviewpro/react";
import { PepReviewPro } from "@pepreviewpro/server";
import { useLoaderData } from "react-router";

const prp = new PepReviewPro({ store: "example-store" });

export async function loader() {
	return { reviews: await prp.reviews.list({ productRef: "sku-123" }) };
}

export default function Product() {
	const { reviews } = useLoaderData<typeof loader>();
	return (
		<main id="main-content">
			<ReviewsJsonLd data={reviews} product={{ name: "BPC-157 10mg", url: "https://store.example/products/sku-123" }} />
			<Carousel data={reviews} />
		</main>
	);
}
```

On Next.js, `getReviews` from `@pepreviewpro/next` caches that read and refreshes it from webhooks.

## API

### Widgets

The widgets are `<Carousel>`, `<ReviewWall>`, `<TrustBadge>`, `<FloatingBadge>`, `<ProductStars>`, `<SidebarPanel>`, `<ReviewTicker>`, and `<TrustSeal>`. Each renders the dashboard widget of the same name. They are client components. Widgets that list reviews skip ones with stars but no text. Those still count toward your rating.

Each widget takes:

| Prop         | What it does                                                                       |
| ------------ | ---------------------------------------------------------------------------------- |
| `data`       | Reviews read on the server. Skips the fetch in the browser.                        |
| `store`      | The store's slug. Defaults to the provider's.                                      |
| `productRef` | Your own product id, for one product's reviews.                                    |
| `limit`      | How many reviews, 1 to 50.                                                         |
| `theme`      | `light`, `dark`, or `auto`. Defaults to the provider's, then your widget settings. |
| `cols`       | Columns, for `<ReviewWall>`.                                                       |
| `minRating`  | Hides reviews under this rating, on top of your store's own minimum.               |
| `link`       | `false` drops the link to your PepReviewPro page.                                  |
| `align`      | `start` or `center`.                                                               |
| `className`  | On the widget's outer element.                                                     |

The widget runtime draws each widget, so it matches the dashboard. Each widget also prints its reviews as plain, visually hidden HTML for search engines and readers without JavaScript. If the runtime cannot load, that plain HTML is shown instead. Every widget marks your reviews as seen once half of it is on screen, and orders placed within 7 days get credit for it.

### `<PepReviewProProvider>`

| Prop           | What it does                                                         |
| -------------- | -------------------------------------------------------------------- |
| `store`        | Your store's slug, for every widget and hook inside it.              |
| `theme`        | Every widget's theme unless it sets its own.                         |
| `consent`      | A boolean, or a function read each time a cookie would be written.   |
| `cookieDomain` | Like `.example.com`, when checkout runs on another subdomain.        |
| `baseUrl`      | Another PepReviewPro server. Defaults to `https://pepreviewpro.com`. |

### Review form

```tsx
"use client";
import { ReviewForm } from "@pepreviewpro/react";

export function WriteReview({ orderId }: { orderId: string }) {
	return <ReviewForm productRef="sku-123" orderRef={orderId} onSubmitted={(response) => console.log(response.review_id)} />;
}
```

`orderRef` lets PepReviewPro match the review to the order it came from. `rating` preselects the stars. The review waits until its author confirms it by email.

The form is unstyled. Every part carries a `data-prp-*` attribute to style it by: `[data-prp-rating]`, `[data-prp-field]`, `[data-prp-field-error]`, `[data-prp-submit-error]`, and `[data-prp-state="success"]`. The rating is a group of five radio buttons, every field has a label, errors are announced, and focus moves to the first problem or to the thank-you message.

### Headless

For your own design, read the data with hooks and print it with the unstyled primitives.

```tsx
"use client";
import { ReviewList, Stars, useAggregate, useReviews } from "@pepreviewpro/react";

export function Reviews() {
	const { reviews, loading } = useReviews({ productRef: "sku-123" });
	const { aggregate } = useAggregate({ productRef: "sku-123" });
	if (loading || !aggregate) {
		return null;
	}

	return (
		<section>
			<Stars rating={aggregate.score} /> {aggregate.total} reviews
			<ReviewList reviews={reviews} />
		</section>
	);
}
```

| Export                         | What it does                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `useReviews(source)`           | `{ reviews, data, loading, error }`. The reviews the widgets list: at or above your store's minimum rating, with text. |
| `useAggregate(source)`         | `{ aggregate, data, loading, error }`: the rating, the count, and the star distribution.                               |
| `useStoreProfile({ store })`   | `{ profile, loading, error }`: your public name, logos, banner, accent color, and description.                         |
| `useSubmitReview(options)`     | `{ submit, status, error, reset }`, for a form of your own.                                                            |
| `validateReview(draft)`        | The form's own field rules, as `{ field: message }`.                                                                   |
| `<Stars rating>`               | Five stars as text, read as one image named by the rating.                                                             |
| `<ReviewList reviews>`         | Reviews as a list of articles: stars, title, body, author, date, verified.                                             |
| `<VerifiedBadge>`              | "Verified purchase".                                                                                                   |
| `<ReviewsJsonLd data product>` | Product markup with the rating and up to 10 reviews, for search engines.                                               |

`<Stars>`, `<ReviewList>`, `<VerifiedBadge>`, and `<ReviewsJsonLd>` are Server Components. The widgets, the form, the hooks, and the provider are marked `"use client"`. The hooks fetch in the browser, and several widgets showing the same reviews share one request.

### JSON-LD

Pass the same `data` the page's widget shows, so the markup and the visible rating agree. It prints nothing for a product with no reviews.

```tsx
import { ReviewsJsonLd, type WidgetData } from "@pepreviewpro/react";

export function ProductMarkup({ data }: { data: WidgetData }) {
	return <ReviewsJsonLd data={data} product={{ name: "BPC-157 10mg", url: "https://store.example/products/sku-123" }} />;
}
```

## Errors

- A hook's `error` holds what went wrong, and `data` stays `null`. Without a `store` prop or a provider, it says so.
- `useStoreProfile` answers with the API's `Store profile is not public` while your public page is off.
- `useSubmitReview`'s `submit` rejects on a refusal, and `error` holds the API's own message to show. `<ReviewForm>` shows it with a **Retry** button.
- A widget that cannot load its data renders nothing. One whose runtime cannot load shows its plain HTML.

## Privacy and security

- It takes no key and never needs one. Never pass a PepReviewPro key to a component or put one in a `NEXT_PUBLIC_` or `VITE_` variable. Keys are secret, even older ones that start with `pk_`.
- The provider and the widgets write two first-party cookies on your site and send nothing anywhere. Nothing is written when the browser sends Global Privacy Control. Pass `consent` to wait for your banner.

  ```tsx
  import { PepReviewProProvider } from "@pepreviewpro/react";
  import type { ReactNode } from "react";

  export function Providers({ children }: { children: ReactNode }) {
  	return (
  		<PepReviewProProvider store="example-store" consent={() => consentBanner.allows("analytics")}>
  			{children}
  		</PepReviewProProvider>
  	);
  }
  ```

- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Show reviews with React](https://pepreviewpro.com/help/show-reviews-with-react), [Get credit for buyers PepReviewPro sends you](https://pepreviewpro.com/help/get-credit-for-buyers-pepreviewpro-sends-you)
- Guides: [Next.js, end to end](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/nextjs.md), [Any other stack](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/any-stack.md)
- Examples: [Remix](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/remix), [Astro](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/astro), [Next.js](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/next-app-router)
- For AI coding agents: `node_modules/@pepreviewpro/react/AGENTS.md`, a guide to every package

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
