# PepReviewPro SDK

Connect a store on any stack to PepReviewPro. Send orders, get credit for the buyers PepReviewPro sends you, and show your reviews in your own HTML. Or, as a directory partner, list PepReviewPro's stores with links that credit you.

## Start here

| You run                                         | Read                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Next.js                                         | [Next.js, end to end](guides/nextjs.md)                    |
| React on Remix, Astro, or Vite                  | [Any other stack](guides/any-stack.md)                     |
| A server without a framework                    | [Any other stack](guides/any-stack.md#a-server-on-its-own) |
| Plain HTML                                      | [Any other stack](guides/any-stack.md#plain-html)          |
| A directory or chat assistant that lists stores | [Directory partners](guides/partners.md)                   |

Every package has its own page here, with its README and its full API: `@pepreviewpro/server`, `@pepreviewpro/browser`, `@pepreviewpro/react`, `@pepreviewpro/next`, `@pepreviewpro/ai`, and `@pepreviewpro/core`. The CLI's commands are in its README. Each package also ships an `AGENTS.md`, a guide for AI coding agents working in a store's codebase.

## Your key is secret

The SDK uses a store key from the dashboard, `sk_live_` and 40 letters and digits. Older keys start with `pk_live_`, and they are just as secret. Only `@pepreviewpro/server` takes one. Keep it on the server, and never in a `NEXT_PUBLIC_` variable. `npx @pepreviewpro/cli doctor` scans your build for one.

## Building these docs

`pnpm docs:build` writes this site to `docs/api/` with [TypeDoc](https://typedoc.org), from the packages' READMEs, the guides in `docs/guides/`, and the types themselves.
