# @pepreviewpro/cli

[![npm](https://img.shields.io/npm/v/@pepreviewpro/cli)](https://www.npmjs.com/package/@pepreviewpro/cli) [![CI](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pepreviewpro/pepreviewpro-sdk/actions/workflows/ci.yml) [![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE)

Set up your PepReviewPro store, check it, and send it orders and products from the command line.

`npx @pepreviewpro/cli init` checks your key and saves it. `npx @pepreviewpro/cli doctor` checks every part of the setup, and fails when a key is built into your client bundle. The other commands import past orders, push your catalog, re-send recent orders, and test your webhook route.

## Which package do I need?

| Your stack                                   | Install                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Next.js 15 or 16, App Router                 | `@pepreviewpro/next` `@pepreviewpro/react` `@pepreviewpro/server`       |
| React on Remix, React Router, Astro, or Vite | `@pepreviewpro/react` `@pepreviewpro/server`                            |
| A server with no React                       | `@pepreviewpro/server`, plus `@pepreviewpro/browser` on your pages      |
| Setup, imports, and checks on any stack      | this CLI, run with `npx @pepreviewpro/cli`                              |
| A directory partner's site or assistant      | `@pepreviewpro/server`, plus `@pepreviewpro/ai` or `@pepreviewpro/next` |

## Requirements

Node 20 or later, and a store key from the PepReviewPro dashboard: **Widgets**, **Integrations**, the **Next.js** or **React** tab, **Store key**.

## Install

Run it with `npx` and the full package name, no install needed:

```sh
npx @pepreviewpro/cli --help
```

Or add it to the project, so scripts and CI use a pinned version:

```sh
# pnpm
pnpm add -D @pepreviewpro/cli

# npm
npm install --save-dev @pepreviewpro/cli

# yarn
yarn add --dev @pepreviewpro/cli
```

Once it is installed, `npx @pepreviewpro/cli` runs that pinned copy. Always give `npx` the full package name: the command's short name is not a package on npm, so anyone could publish one under it.

## Quick start

```sh
npx @pepreviewpro/cli init
npx @pepreviewpro/cli doctor
```

`init` asks for your key and your store's slug, checks them with PepReviewPro, and writes both to `.env.local` after you say yes. It then offers to add a short section to your project's AGENTS.md, so AI coding agents read the SDK's guide before they write code. **The key is secret and server only.**

## Commands

| Command                                           | What it does                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `init [--store <slug>] [--yes] [--no-agents]`     | Checks the key, then saves `PEPREVIEWPRO_API_KEY` and `PEPREVIEWPRO_STORE`, and points AGENTS.md at the SDK's guides.     |
| `doctor [--dir <build>]`                          | Checks Node, the key, the store, the installed packages, the webhook secret, and the client bundle. Exits 1 on a failure. |
| `import-orders <file> [--restart]`                | Sends past orders with no email. Resumes where it stopped.                                                                |
| `push-catalog <file.json>`                        | Sends your products, shipping, and payment methods.                                                                       |
| `sync-orders [<file> \| -] [--since 48h] [--csv]` | Sends recent orders again, with email on. Reads stdin when no file is given.                                              |
| `webhooks test <url> [--secret whsec_...]`        | Sends a signed `ping` to your webhook route and says whether it answered 2xx.                                             |

`--store` overrides the store on any command. `--help` and `--version` work anywhere.

### Configuration

Every command reads these from the shell, then `.env.local`, then `.env`:

| Variable                      | Used by                               |
| ----------------------------- | ------------------------------------- |
| `PEPREVIEWPRO_API_KEY`        | every command but `webhooks test`     |
| `PEPREVIEWPRO_STORE`          | every command                         |
| `PEPREVIEWPRO_WEBHOOK_SECRET` | `webhooks test`, and `doctor`'s check |
| `PEPREVIEWPRO_BASE_URL`       | every command. Leave unset.           |

### `init` and AI coding agents

With your yes, `init` adds a marked block to `AGENTS.md`, creating the file if it is missing, and to `CLAUDE.md` if you have one. The block tells agents to read `node_modules/@pepreviewpro/<package>/AGENTS.md` before they write PepReviewPro code, naming the packages your project has. Running `init` again updates the block in place, between its markers, and never adds a second one. `CLAUDE.md` is left alone when it already imports `@AGENTS.md`.

- `--no-agents` skips this step.
- `--yes` answers yes to every question, for scripts and agents. Without a terminal and without `--yes`, `init` writes nothing.

```sh
npx @pepreviewpro/cli init --store example-store --yes
```

Without a terminal, `init` takes the key from `PEPREVIEWPRO_API_KEY`. Set it from your secrets store, never in the command itself, where shell history keeps it.

## Order files

`import-orders` and `sync-orders` take JSON: an array of orders, `{ "orders": [...] }`, or one order per line. Field names can be the SDK's (`lineItems`, `createdAt`) or the API's (`line_items`, `created_at`).

```json
[
	{
		"id": "ORD-1001",
		"status": "completed",
		"email": "buyer@example.com",
		"completed_at": "2026-11-02T16:00:00Z",
		"line_items": [{ "product_id": "sku-123", "name": "BPC-157 10mg", "quantity": 2, "total": 99 }]
	}
]
```

They also take CSV, with one row per line item. Rows that share an `id` are one order.

```csv
id,status,email,name,created_at,completed_at,total,currency,product_id,product_name,quantity,line_total
ORD-1001,completed,buyer@example.com,Alex Example,2026-11-02T14:00:00Z,2026-11-02T16:00:00Z,129.5,USD,sku-123,BPC-157 10mg,2,99
```

`status` is `pending`, `paid`, `completed`, `refunded`, or `cancelled`. Every row is checked before anything is sent.

### Resuming an import

`import-orders` saves its place beside the file, in `<file>.pepreviewpro-checkpoint.json`, after every batch of 200. Run the same command again after a failure and it carries on. A changed file starts over, and so does `--restart`.

### The daily re-send

`sync-orders` sends every order that changed in the window, with email on. Orders PepReviewPro already has come back unchanged. One it missed is created, and its request goes out late. Orders with no date are left out, so a full export can never mail old buyers. You supply the orders: export the last two days and pipe them in, once a day.

```sh
my-store-export --since 48h --format json | npx @pepreviewpro/cli sync-orders --since 48h
```

### Catalog files

`push-catalog` takes `{ "products": [...], "ships_to": [...], "ships_from": "US", "payment_methods": [...] }`, in either naming, or a bare array of products. Each product needs an `id` and a `name`.

### Testing your webhook route

```sh
npx @pepreviewpro/cli webhooks test http://localhost:3000/api/pepreviewpro
```

It signs a `ping` the way PepReviewPro does, with `PEPREVIEWPRO_WEBHOOK_SECRET` or `--secret`, for `PEPREVIEWPRO_STORE` or `--store`. A 401 means the route has a different secret.

## Errors

Every command exits 0 on success and 1 on a failure, with a message and no stack trace. `doctor` prints one `ok`, `warn`, or `fail` line per check, and exits 1 if any check fails. An API refusal prints the API's own error, like `PepReviewPro answered 401: Invalid API key`.

## Security

- **The key is secret and server only.** Older keys start with `pk_`, and they are just as secret. `init` reads it without echoing it.
- `init` creates `.env.local` readable only by you, and tells you when `.gitignore` does not cover it.
- `doctor` fails when it finds a whole key in your client build, or a key in a `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, or `REACT_APP_` variable. It prints only the key's first characters.
- Releases are published from GitHub Actions through npm trusted publishing, with provenance.

## Help and docs

- Help center: [Connect a store that isn't on WordPress](https://pepreviewpro.com/help/connect-a-store-without-wordpress), [Import your past orders](https://pepreviewpro.com/help/import-your-past-orders), [Send orders from your checkout](https://pepreviewpro.com/help/send-orders-from-your-checkout)
- Guide: [Next.js, end to end](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/docs/guides/nextjs.md)
- For AI coding agents: `node_modules/@pepreviewpro/cli/AGENTS.md`, when installed

## Support

Email bugs, questions, and security reports to support@pepreviewpro.com. Issues and pull requests are closed on GitHub.

## License

The source is public to read at [github.com/pepreviewpro/pepreviewpro-sdk](https://github.com/pepreviewpro/pepreviewpro-sdk). Your use of it is governed by the PepReviewPro SDK License in [`LICENSE`](https://github.com/pepreviewpro/pepreviewpro-sdk/blob/main/LICENSE), which ships with this package.
