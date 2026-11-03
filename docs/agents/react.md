# @pepreviewpro/react: a guide for coding agents

You are working in a store's React app that uses `@pepreviewpro/react`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code. The second half covers every PepReviewPro package, so you need no other guide.

## What this package gives a React app

- One component per dashboard widget, named as the dashboard names it: `Carousel`, `ReviewWall`, `TrustBadge`, `FloatingBadge`, `ProductStars`, `SidebarPanel`, `ReviewTicker`, `TrustSeal`. They are client components. The widget runtime from `https://pepreviewpro.com/embed/widgets.js` draws them, and each also prints its reviews as plain HTML for search engines.
- `ReviewForm`, a client component that posts a review with the store's own product and order ids.
- `PepReviewProProvider`, a client component that sets the store and theme, and records the shopper's first touch.
- Hooks: `useReviews`, `useAggregate`, `useStoreProfile`, `useSubmitReview`. They fetch in the browser.
- `Stars`, `ReviewList`, `VerifiedBadge`, and `ReviewsJsonLd`. They are Server Components with no `"use client"`, so they also render on the server.

It takes no key, and everything it reads is public. Never pass it a key, and never import `@pepreviewpro/server` next to it in client code.

## Before you start

1. Find where the app renders on the server: a Next.js Server Component, a Remix or React Router `loader`, Astro frontmatter, or `getServerSideProps`. Read the reviews there with `@pepreviewpro/server`, or with `getReviews` from `@pepreviewpro/next` on the App Router, and pass them to a widget as `data`. A widget without `data` fetches in the browser, and its reviews are not in the HTML.
2. Put one `PepReviewProProvider` at the root. Widgets outside it need a `store` prop.
3. Use the store's own product id as `productRef`, the same one its orders send in line items.

## Props worth knowing

| Prop         | On                   | Does                                                                         |
| ------------ | -------------------- | ---------------------------------------------------------------------------- |
| `data`       | every widget         | Reviews read on the server. Skips the browser fetch.                         |
| `store`      | widgets, hooks, form | The store's slug. Defaults to the provider's.                                |
| `productRef` | widgets, hooks, form | The store's own product id, for one product's reviews.                       |
| `limit`      | widgets, hooks       | How many reviews, 1 to 50.                                                   |
| `theme`      | provider, widgets    | `light`, `dark`, or `auto`.                                                  |
| `minRating`  | widgets              | Hides reviews under this rating, on top of the store's own minimum.          |
| `orderRef`   | form                 | The store's own order id, so the review matches its order.                   |
| `rating`     | form                 | Preselects the stars.                                                        |
| `consent`    | provider             | A boolean or a function. Waits for the cookie banner before writing cookies. |

Do not invent props. The types in `dist/*.d.ts` list every one.
