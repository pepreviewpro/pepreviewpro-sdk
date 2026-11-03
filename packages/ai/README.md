# @pepreviewpro/ai

[![npm](https://img.shields.io/npm/v/@pepreviewpro/ai)](https://www.npmjs.com/package/@pepreviewpro/ai) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

A `find_vendors` tool for the AI SDK. Your assistant answers "where can I buy this" from the PepReviewPro directory, with links that credit you.

The tool reads the directory, lets go of a filter that matches nothing and says which, and reports a store the user named that the directory lacks. The model gets a short list of facts to state. Your app gets the stores, ready to draw as cards. This package is for directory partners. A store connecting its own checkout wants `@pepreviewpro/server`.

## Which package do I need?

| You are                        | Install                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| A chat assistant on the AI SDK | `@pepreviewpro/ai` `@pepreviewpro/server`                         |
| A directory or comparison site | `@pepreviewpro/server`, plus `@pepreviewpro/next` on Next.js      |
| A store on Next.js 15 or 16    | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server` |
| A store on any other stack     | `@pepreviewpro/server`, plus `@pepreviewpro/react` or `browser`   |

## Requirements

- `ai` 7 and `zod` 4, which you install yourself.
- Node 20 or later, or an edge runtime. The tool runs on the server, where your key is.
- A partner key from the PepReviewPro dashboard, under **API**, **Keys**, with **Read the vendor directory** (`stores:read`). Ask support@pepreviewpro.com to link it to your partner account, so your clicks credit you.

## Install

```sh
# pnpm
pnpm add @pepreviewpro/ai @pepreviewpro/server ai zod

# npm
npm install @pepreviewpro/ai @pepreviewpro/server ai zod

# yarn
yarn add @pepreviewpro/ai @pepreviewpro/server ai zod
```

```sh
PEPREVIEWPRO_API_KEY=pk_live_...   # your partner key: secret, server only
```

## Quick start

A Next.js chat route. Any server that runs the AI SDK works the same way.

```ts
// app/api/chat/route.ts
import { createFindVendorsTool, FIND_VENDORS_INSTRUCTIONS } from "@pepreviewpro/ai";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

const partner = new PepReviewProPartner({ maxRetries: 1, timeoutMs: 5000 });

export async function POST(request: Request) {
	const { messages }: { messages: UIMessage[] } = await request.json();
	const result = streamText({
		model: "openai/gpt-5-mini",
		system: `You help people research peptides.\n\n${FIND_VENDORS_INSTRUCTIONS}`,
		messages: await convertToModelMessages(messages),
		tools: { find_vendors: createFindVendorsTool(partner) },
		stopWhen: stepCountIs(3)
	});
	return result.toUIMessageStreamResponse();
}
```

Register the tool as `find_vendors`, the name `FIND_VENDORS_INSTRUCTIONS` uses. Draw a card for each store in the tool part's `output.stores`, and link `store.link`.

## API

### `createFindVendorsTool(partner, options?)`

Returns an AI SDK `tool()`. The model fills `compound`, `ships_to`, `payment`, `store_name`, and `limit`, each described so it keeps a compound out of `store_name` and never guesses a country.

| Option            | Default           | What it does                                                                                                  |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `defaultLimit`    | `3`               | Stores a call returns when the model leaves `limit` unset.                                                    |
| `maxLimit`        | `6`               | The most stores the model may ask for.                                                                        |
| `resolveCompound` | the text as given | `(text, context)` maps your own vocabulary to a compound the API knows. Return null for one you do not know.  |
| `fallbackCountry` | none              | `(context)` returns a two-letter code to use when the user named no country, like one from their profile.     |
| `overlayLinks`    | none              | `(store, product, context)` returns `{ url, productUrl, discountCode }` of your own, like an affiliate's.     |
| `reportMisses`    | on                | Reports a store the user named that the directory lacks. `{ includeQuestion: false }` leaves their words out. |
| `reportShown`     | off               | Reports the stores returned as `shown`. Turn it on if you send `shown` events anywhere, or cache results.     |
| `paymentMethods`  | all eight         | The payment methods the model may filter by.                                                                  |
| `cards`           | `true`            | Your app draws a card for each store. `false` gives the model each store's link to write instead.             |

`context` carries the conversation: `question`, the user's last message, then `messages`, `toolCallId`, the AI SDK's tool `context`, and `abortSignal`.

### What the tool returns

`FindVendorsResult` is what your cards read:

| Field             | What it is                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `stores`          | Each with `slug`, `name`, `rating`, `score`, `reviewCount`, `link`, `profileUrl`, and the best `product`. |
| `applied`         | The filters every store shown meets, each with a `label` like "Canada".                                   |
| `dropped`         | Filters that matched nothing and were let go to find these stores.                                        |
| `notInDirectory`  | The store the user named, when the directory does not review it.                                          |
| `unknownCompound` | The compound asked for, when `resolveCompound` returned null or the API does not know it.                 |
| `storeName`       | The store name the user asked about, if any.                                                              |
| `shipsToFrom`     | `input` when the country came from the user, `fallback` when it came from `fallbackCountry`.              |
| `empty`           | Nothing to draw: no stores and no not-in-directory line.                                                  |

The model never sees this object. It sees `describeFindVendorsResult(result)`: a Facts line to state in its own words, each store's star rating, review counts, and best product, and the rule not to soften them. `rating` is the average stars; `score` is the PepReviewPro score the directory ranks by, kept on the result for your cards. "N more matching products" comes from the API's count of every match, not only the three it returns.

### How it searches

1. A store name comes first. It reads stores by that name, with the compound when one was asked. A name the directory lacks is reported as a vendor miss, in the background, and the rest of the question still gets an answer when it named a compound or a country.
2. Otherwise it reads stores with every filter. If none match, it tries the compound alone, then the country and payment alone, then the top-rated stores. That is at most four reads.
3. With a compound, each store carries up to three matching products, and stores with one in stock come first.

Until you send your first `shown` event, each store a read returns counts as your impression in that store's insights. After it, only `shown` events count.

### Links that credit you

`store.link` and `product.link` are the tracked links, `clickUrl` from the API. On a key not yet linked to your partner account there is none, so they fall back to the store's own pages and earn no credit. With `overlayLinks`, a URL of yours on the store's own site rides inside the tracked link, so the buyer lands on it and the store still sees the visit came from you. A URL elsewhere, like an affiliate redirector, comes back as `untrackedUrl`. Linking that earns no credit unless you report a `click` event with `partner.events.report`.

```ts
import { createFindVendorsTool } from "@pepreviewpro/ai";
import { PepReviewProPartner } from "@pepreviewpro/server";

const partner = new PepReviewProPartner();

export const findVendors = createFindVendorsTool(partner, {
	resolveCompound: (text) => (text.toLowerCase() === "bpc" ? "bpc-157" : text),
	overlayLinks: (store) => (store.slug === "example-store" ? { url: "https://store.example/?ref=partner", discountCode: "PARTNER10" } : null)
});
```

### Other exports

| Export                                   | What it does                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `FIND_VENDORS_INSTRUCTIONS`              | A paragraph for your system prompt, written for a tool registered as `find_vendors`. |
| `describeFindVendorsResult(result, opt)` | The text the model reads. `toModelOutput` calls it.                                  |
| `findVendors(partner, input, options)`   | The search itself, for a stack without the AI SDK.                                   |

## Errors

The tool throws what `@pepreviewpro/server` throws, and the AI SDK hands it to the model as a tool error. `PepReviewProApiError.isAuthError` means the key is wrong or lacks `stores:read`. Vendor-miss and shown reports need `partner:write`. A country the API rejects costs only that filter, never the answer. Vendor-miss and shown reports run in the background and never throw.

Chat turns cannot wait long. Give the partner client a short budget, like `{ maxRetries: 1, timeoutMs: 5000 }`. The tool also stops when the AI SDK aborts the call.

## Security

- **The key is secret.** A `pk_live_` key is as secret as any other. Keep it in a server environment variable. `@pepreviewpro/server` throws if it is imported in a browser bundle.
- The tool never sends the user's identity. With `reportMisses` on, a missed store's report carries the user's last message as `question`, cut to 200 characters. Pass `reportMisses: { includeQuestion: false }` if that message could identify them.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Create an API key](https://pepreviewpro.com/help/create-an-api-key), [What are the API limits?](https://pepreviewpro.com/help/api-rate-limits)
- Guide: [Directory partners](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/partners.md)
- Example: [A directory page and a chat route on Next.js](https://github.com/pepreviewpro/pepreviewpro-sdk/tree/main/examples/partner-next)
- For AI coding agents: `node_modules/@pepreviewpro/ai/AGENTS.md`

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
