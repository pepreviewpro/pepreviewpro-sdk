# @pepreviewpro/ai: a guide for coding agents

You are working in the codebase of a directory partner: a chat assistant or a site that lists PepReviewPro stores to its own users. It uses `@pepreviewpro/ai`. This file is the package's guide for AI coding agents. Read it before you write PepReviewPro code. The second half covers every partner task, so you need no other guide.

## What this package gives an assistant

| Export                                       | For                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `createFindVendorsTool(partner, options)`    | The AI SDK tool. Register it as `find_vendors` in `tools`.                     |
| `FIND_VENDORS_INSTRUCTIONS`                  | The paragraph to add to the system prompt. It names the tool `find_vendors`.   |
| `describeFindVendorsResult(result, options)` | What the model reads after a call. The tool's `toModelOutput` already uses it. |
| `findVendors(partner, input, options)`       | The same search without the AI SDK, for another model library.                 |

It needs `ai` 7 and `zod` 4 in the project. Check `package.json`, and install them with the project's own package manager if they are missing.

## Rules for the tool

1. **Make one tool per partner client, on the server.** Build the `PepReviewProPartner` once, in a server-only module, with a short budget: `{ maxRetries: 1, timeoutMs: 5000 }`. Never import it in a file marked `"use client"`.
2. **Register it as `find_vendors`** and add `FIND_VENDORS_INSTRUCTIONS` to the system prompt. Do not rewrite the instructions or the tool's descriptions. They keep compounds out of `store_name` and stop the model from guessing a country.
3. **Draw cards from `output.stores`, and link `store.link` and `product.link`.** They are the tracked links. Never link a store's website from anywhere else. If the app does not draw cards, pass `cards: false`, so the model writes the tracked links itself.
4. **Map the app's own words in `resolveCompound`,** not in the prompt. Return null for a compound the app does not know, and the answer says so.
5. **Attach affiliate links through `overlayLinks`.** A URL on the store's own site rides inside the tracked link. One elsewhere comes back as `untrackedUrl`, and a click on it needs a `click` event to count.
6. **Leave `reportMisses` on.** It tells PepReviewPro which stores users ask about. If the user's message could identify them, pass `{ includeQuestion: false }`.

```ts
import { createFindVendorsTool, FIND_VENDORS_INSTRUCTIONS } from "@pepreviewpro/ai";
import { PepReviewProPartner } from "@pepreviewpro/server";
import { generateText, stepCountIs } from "ai";

const partner = new PepReviewProPartner({ maxRetries: 1, timeoutMs: 5000 });

const { text } = await generateText({
	model: "openai/gpt-5-mini",
	system: FIND_VENDORS_INSTRUCTIONS,
	prompt: "Where can I buy BPC-157 shipped to Canada?",
	tools: { find_vendors: createFindVendorsTool(partner, { fallbackCountry: () => "US" }) },
	stopWhen: stepCountIs(3)
});
```

## Verify the tool

- [ ] A test calls the tool through a mock model from `ai/test`, `MockLanguageModelV4`, and checks `output.stores[0].link` starts with `https://pepreviewpro.com/go/`.
- [ ] No card or message links `websiteUrl` or `pageUrl` while a tracked `link` exists.
- [ ] The system prompt includes `FIND_VENDORS_INSTRUCTIONS`, and the tool's key is `find_vendors`.
