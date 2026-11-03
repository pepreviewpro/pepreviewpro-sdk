# @pepreviewpro/browser

[![npm](https://img.shields.io/npm/v/@pepreviewpro/browser)](https://www.npmjs.com/package/@pepreviewpro/browser) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

Credit for the buyers PepReviewPro sends you, and for orders placed after a buyer saw your reviews.

It writes two first-party cookies on your own site and sends nothing anywhere. At checkout, `@pepreviewpro/server` reads them from the request and sends them with the order. It has no dependencies, stays under 3 kB gzipped, and takes no key.

## Which package do I need?

| Your stack                                   | Install                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`        |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                             |
| Pages you render yourself, no React          | `@pepreviewpro/browser` on the pages, `@pepreviewpro/server` at checkout |
| A directory partner's site or assistant      | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next`  |

On React, you do not need this package directly: `<PepReviewProProvider>` and the widgets from `@pepreviewpro/react` call it for you.

## Requirements

Any modern browser. It is safe to import during server rendering, where it does nothing.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/browser

# npm
npm install @pepreviewpro/browser

# yarn
yarn add @pepreviewpro/browser
```

## Quick start

Call `captureAttribution()` once on every page load.

```ts
import { captureAttribution } from "@pepreviewpro/browser";

captureAttribution();
```

If you render reviews yourself, mark them seen when they are on screen.

```ts
import { trackReviewsSeen } from "@pepreviewpro/browser";

const reviews = document.querySelector("#reviews");
if (reviews) {
	trackReviewsSeen(reviews);
}
```

At checkout, pass the request to `prp.orders.upsert(order, { request })` from `@pepreviewpro/server`. There is nothing else to wire when checkout runs on the same site.

## API

| Export                                                    | What it does                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `captureAttribution(options?)`                            | On a landing with `prp_click_id`, a UTM tag, or a referrer from another site, stores the first touch. Returns it, or `null`. |
| `trackReviewsSeen(element, options?)`                     | Marks the reviews seen once half of `element` is on screen. Returns a function that stops watching.                          |
| `readCheckoutContext(options?)`                           | `{ attribution, reviews_seen_at }`, for a checkout on another domain.                                                        |
| `isTrackingAllowed(consent)`                              | False under Global Privacy Control or when `consent` says no.                                                                |
| `attributionFromLanding(url, referrer)`                   | The first touch a landing would record, without writing it. The Next.js proxy uses it.                                       |
| `parseAttribution`, `parseReviewsSeen`, `serializeCookie` | The cookie rules, for server code.                                                                                           |

`options` takes `consent`, a boolean or a function read each time a cookie would be written, and `cookieDomain`, like `.example.com`.

### What it stores

| Cookie             | When                                                                                                     | Kept    |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------- |
| `prp_attribution`  | The first landing with `prp_click_id`, a UTM tag, or a referrer from another site. The first touch wins. | 30 days |
| `prp_reviews_seen` | Half of a reviews element was on screen. Unix seconds.                                                   | 7 days  |

Both are first-party, `SameSite=Lax`, on the whole site, and `Secure` on https.

### Checkout on another domain

Send the context with the checkout request, and pass it to the server.

```ts
import { readCheckoutContext } from "@pepreviewpro/browser";

await fetch("https://checkout.example.com/api/orders", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({ cartId: "cart-1001", pepreviewpro: readCheckoutContext() })
});
```

On that server, call `prp.orders.upsert(order, { context: body.pepreviewpro })`. For subdomains of one site, `captureAttribution({ cookieDomain: ".example.com" })` shares the cookie instead.

## Errors

`captureAttribution`, `trackReviewsSeen`, and `readCheckoutContext` never throw. Without a DOM, or when tracking is off, they do nothing and return `null`, a no-op, or an empty context. `attributionFromLanding` throws a `TypeError` for a URL that does not parse.

## Privacy and security

- Nothing is written when the browser sends Global Privacy Control. Pass `consent` to wait for your banner:

  ```ts
  import { captureAttribution } from "@pepreviewpro/browser";

  captureAttribution({ consent: () => consentBanner.allows("analytics") });
  ```

- It never sends anything to PepReviewPro or anyone else, and it never needs a key. Never add a PepReviewPro key to browser code.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Get credit for buyers PepReviewPro sends you](https://pepreviewpro.com/help/get-credit-for-buyers-pepreviewpro-sends-you)
- Example: [one HTML file](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/vanilla)
- For AI coding agents: `node_modules/@pepreviewpro/browser/AGENTS.md`

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
