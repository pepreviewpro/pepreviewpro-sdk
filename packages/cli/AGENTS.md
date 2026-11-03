# @pepreviewpro/cli: a guide for coding agents

The `pepreviewpro` command sets up a store, checks it, and sends it orders and products. This file is the CLI's guide for AI coding agents. Run it with `npx @pepreviewpro/cli <command>`.

## Commands

| Command                                         | Does                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `init [--store <slug>] [--yes] [--no-agents]`   | Checks the key, offers to write `.env.local`, and offers to point AGENTS.md at the SDK's guides.         |
| `doctor [--dir <build>]`                        | Checks the key, the store, the packages, the webhook secret, and the client build. Exits 1 on a failure. |
| `import-orders <file> [--restart]`              | Sends past orders with no email. CSV or JSON. Resumes after a failure.                                   |
| `push-catalog <file.json>`                      | Sends the products, shipping, and payment methods.                                                       |
| `sync-orders [<file>\|-] [--since 48h] [--csv]` | Re-sends recent orders with email on. Reads stdin by default. Leaves out orders with no date.            |
| `webhooks test <url> [--secret whsec_...]`      | Sends a signed `ping` to a webhook route and checks for a 2xx.                                           |

Every command reads `PEPREVIEWPRO_API_KEY`, `PEPREVIEWPRO_STORE`, and `PEPREVIEWPRO_WEBHOOK_SECRET` from the shell, `.env.local`, or `.env`.

## Rules

- Without a terminal, `init` needs `PEPREVIEWPRO_API_KEY` in the environment, `--store`, and `--yes` to write anything. Without `--yes` it writes nothing.
- Never pass the key on the command line. It ends up in shell history. Set it in the environment.
- Use `import-orders` for history and `sync-orders` only for a recent window. `sync-orders` sends email.
- Run `doctor` last, after a build, and fix every `fail` line.

## The rest of the SDK

This file covers one package. The guide to every package, with the step-by-step recipes for orders, imports, the catalog, server-rendered reviews, JSON-LD, webhooks, and the review form, ships inside the other packages. Read the first of these that exists:

1. `node_modules/@pepreviewpro/next/AGENTS.md`
2. `node_modules/@pepreviewpro/react/AGENTS.md`
3. `node_modules/@pepreviewpro/server/AGENTS.md`

Three rules apply everywhere. The key is secret and server only, even an old `pk_live_` one. `@pepreviewpro/server` never goes in browser code. Past orders go through `orders.import`, which sends no email. Finish with `npx @pepreviewpro/cli doctor`.

Help center: https://pepreviewpro.com/help/connect-a-store-without-wordpress. Questions: support@pepreviewpro.com.
