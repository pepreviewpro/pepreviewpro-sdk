---
"@pepreviewpro/core": patch
"@pepreviewpro/server": patch
"@pepreviewpro/browser": patch
"@pepreviewpro/react": patch
"@pepreviewpro/next": patch
"@pepreviewpro/cli": minor
---

Ship an `AGENTS.md` in every package: a guide for AI coding agents working in a store's codebase. The `next`, `react`, and `server` guides cover every package.

- `@pepreviewpro/cli`: every doc, help line, and message runs it as `npx @pepreviewpro/cli`, the package's own name. `init` offers to add a marked PepReviewPro block to the project's `AGENTS.md`, and to `CLAUDE.md` when there is one, pointing agents at the installed packages' guides. Running it again updates the block in place. `--no-agents` skips the step, and `--yes` answers every question for scripts and agents.
- Every package names its repository, `github.com/pepreviewpro/pepreviewpro-sdk`, and a help-center page as its homepage, and is published with npm provenance.
