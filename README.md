# PepReviewPro SDK

[![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](LICENSE)

Connect a store on any stack to PepReviewPro: orders, past orders, the catalog, attribution, and reviews in your own HTML. Or list PepReviewPro's stores on your own site or assistant, with links that credit you.

This repository is the source of the `@pepreviewpro/*` packages on npm. If you are connecting a store or listing stores, start with the package for your stack below, and its README. This page is for working on the SDK itself.

## Which package do I need?

| Your stack                                   | Install                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`     |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                          |
| A server with no React                       | `@pepreviewpro/server`, plus `@pepreviewpro/browser` on your pages    |
| Plain HTML, no build                         | The widget script tag from the dashboard. Orders still need a server. |
| Setup, imports, and checks                   | `npx @pepreviewpro/cli` from `@pepreviewpro/cli`                      |
| A directory partner's site                   | `@pepreviewpro/server`, plus `@pepreviewpro/next` on Next.js          |
| A directory partner's chat assistant         | `@pepreviewpro/ai` `@pepreviewpro/server`                             |

### For directory partners

A directory partner lists PepReviewPro stores to its own users: a comparison site, a review roundup, or a chat assistant. `PepReviewProPartner` in `@pepreviewpro/server` reads the directory and reports what you showed. `@pepreviewpro/ai` turns it into one AI SDK tool, and `@pepreviewpro/next` caches the reads. Every store and product carries `clickUrl` and `profileUrl`: link those, and the store sees the visit came from you. [The partner guide](docs/guides/partners.md) covers the whole setup.

## Packages

| Package                                     | Runs        | What it does                                                                                       |
| ------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| [`@pepreviewpro/server`](packages/server)   | server only | Orders, imports, catalog, reviews for server rendering, JSON-LD, webhooks, and the partner client. |
| [`@pepreviewpro/browser`](packages/browser) | browser     | Attribution and reviews-seen cookies. No dependencies, sends nothing.                              |
| [`@pepreviewpro/react`](packages/react)     | React 18+   | The dashboard's widgets, the review form, headless hooks. Takes no key.                            |
| [`@pepreviewpro/next`](packages/next)       | Next.js 15+ | Cached reviews, JSON-LD, the webhook route, attribution in proxy, cached directory reads.          |
| [`@pepreviewpro/ai`](packages/ai)           | server only | The `find_vendors` tool for the AI SDK, for partners' assistants.                                  |
| [`@pepreviewpro/core`](packages/core)       | anywhere    | The typed HTTP client the others build on. Holds no secrets.                                       |
| [`@pepreviewpro/cli`](packages/cli)         | Node        | `init`, `doctor`, `import-orders`, `push-catalog`, `sync-orders`, `webhooks test`.                 |

Every package ships its README, an `AGENTS.md` for AI coding agents working in a store's or a partner's codebase, the license, and built ESM with `.d.ts` types. No sources, tests, or source maps.

## Layout

| Path                                       | What is there                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/*`                               | The seven published packages. Each `src/index.ts` is its public API.                                                            |
| `docs/guides/`                             | Cross-package guides, published in the TypeDoc site.                                                                            |
| `docs/agents/`                             | The source of every package's `AGENTS.md`. `pnpm agents` writes them. Edit here, never in `packages/`.                          |
| `examples/`                                | Next.js, Remix, Astro, Express with Stripe, plain HTML, and a partner's Next.js app, each run in CI against recorded responses. |
| `test/`                                    | Repo-wide tests and the replay server. `test/fixtures/` holds recorded API responses.                                           |
| `scripts/`                                 | Codegen, the replay server, the snippet check, packing, and releasing.                                                          |
| `.github/workflows/`                       | `ci.yml` on every push and pull request; `release.yml` on `main`.                                                               |
| `AGENTS.md`, `CLAUDE.md`, `.agents/rules/` | How to work on this repository, for people and coding agents.                                                                   |

## Development

Building and testing need Node 22.18 or later and pnpm. The packages run on Node 20 and later; `pnpm smoke` checks the built output on the Node you run it with, and CI runs it on Node 20.

```sh
pnpm install
pnpm lint            # ESLint and Prettier
pnpm typecheck
pnpm test            # Vitest, against recorded API responses
pnpm build           # tsdown: ESM and .d.ts, no source maps
pnpm size            # size budgets
pnpm docs:snippets   # type-checks every TypeScript sample in the READMEs, AGENTS.md files, and docs. Build first
pnpm pack:check      # packs every package and checks each tarball. Build first
pnpm agents          # writes packages/*/AGENTS.md from docs/agents/
pnpm smoke           # the built packages, end to end, without the toolchain
pnpm examples:build  # builds the examples against the replay server
pnpm examples:test   # Playwright on the Next.js examples, HTML checks on Remix and Astro
pnpm docs:build      # TypeDoc site in docs/api
```

The examples' tests need Chromium once: `pnpm --filter example-next-app-router exec playwright install chromium`.

### Docs that cannot drift

- `pnpm docs:snippets` type-checks every `ts` and `tsx` block in the Markdown against the built packages, resolved through their `exports` as a store's project would. Calls to a store's own code, like `saveOrder`, go through the stand-ins in `scripts/snippets/storeCode.d.ts`. A block that cannot stand alone, like a signature list, gets `<!-- snippet: partial -->` on the line above its fence.
- `test/agentGuides.test.ts` fails when a package's `AGENTS.md` differs from what `docs/agents/` builds.
- `test/manifests.test.ts` checks every `package.json`: the license, the repository, the homepage, and the files that ship.

### Recorded responses

Tests answer every request from fixtures in the app's own format:

- `test/fixtures/api/` holds copies of the app's own API contract recordings, anonymised.
- `test/fixtures/contract/` holds responses written from the SDK wire contract for endpoints the app has not recorded yet.

`pnpm sync-fixtures --app <path to the app> [--endpoints apiEndpoints.json]` copies the app's recordings in and anonymises them on the way. A recording replaces the contract version of the same name. Staff-only endpoints are left out of the endpoints snapshot. `pnpm sync-fixtures --local` re-runs the same pass over the fixtures already here.

`pnpm replay [--port 4010] [-- <command>]` serves the same recordings over HTTP, with a stand-in for the widget runtime, and runs the command with `PEPREVIEWPRO_BASE_URL` pointing at it. The examples build and test against it.

All data in fixtures, examples, and docs is fictional: the store `example-store`, the domains `store.example` and `example.com`, and ids like `ORD-1001` and `sku-123`.

### Types and the API docs

The response types in `packages/core/src/types.ts` are hand-written for 0.x. `pnpm codegen <apiEndpoints.json>` reads the API's exported endpoint reference and fails on any required field the SDK reads that the documented response examples lack. CI runs it against `test/fixtures/apiEndpoints.json`.

## Releasing

Versions come from [Changesets](https://github.com/changesets/changesets), and all packages share one version. Run `pnpm changeset` with each change and commit the file it writes. On `main`, the Release workflow keeps a **Version Packages** pull request open. Merging it publishes every new version to npm from GitHub Actions, through npm trusted publishing with provenance. No npm token or personal access token is stored anywhere.

[`RELEASING.md`](RELEASING.md) has the whole flow and the owner's one-time setup.

## Support and license

Issues and pull requests are closed. Email bugs, questions, and security reports to support@pepreviewpro.com, as [`SECURITY.md`](SECURITY.md) describes.

The source is public to read. Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](LICENSE).
