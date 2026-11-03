# Working on the PepReviewPro SDK

This file is for people and coding agents who change this repository. It is not published, and it is not the guide for a store's codebase. Those guides are `packages/*/AGENTS.md`, which ship inside each npm package and are built from `docs/agents/`.

## Rules

Follow every file in `.agents/rules/`. `CLAUDE.md` imports them for Claude Code. Other agents should read them directly:

- `.agents/rules/formatting.md`: braces always, and where blank lines go.
- `.agents/rules/comments.md`: when a comment earns its place.
- `.agents/rules/functions.md`: one exported function per file, the public API, and dependencies.
- `.agents/rules/compatibility.md`: the API contract the SDK must not outrun, and fictional data only.

## Commands

Run these before you hand work back. `docs:snippets` and `pack:check` need a build first.

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm docs:snippets && pnpm pack:check
```

## Changing docs

- A package's README is its npmjs.com page. Every claim in it must match the code. Read the source before you describe behaviour.
- Edit an agent guide in `docs/agents/`, then run `pnpm agents`. Never edit `packages/*/AGENTS.md` by hand: `test/agentGuides.test.ts` fails when they differ. `guide.md` is the cross-package guide that the `next`, `react`, and `server` files carry. `pointer.md` closes the other three.
- Every `ts` and `tsx` block must type-check against the built packages. A call to a store's own code goes through a stand-in in `scripts/snippets/storeCode.d.ts`. A block that cannot stand alone gets `<!-- snippet: partial -->` above its fence.
- Voice: calm, plain, short sentences. No em dashes, no exclamation points, no hype.
- Use fictional data only: `example-store`, `store.example`, `example.com`, `ORD-1001`, `sku-123`.

## Changing a package

- Add a changeset with `pnpm changeset`. A removed or renamed export is breaking, as `.agents/rules/functions.md` says.
- `files` in each `package.json` is `dist`, `AGENTS.md`, `LICENSE`, and `README.md`. `pnpm pack:check` shows exactly what npm would get.
- Releases follow `RELEASING.md`. Never publish by hand, and never add an npm token.
