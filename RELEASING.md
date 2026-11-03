# Releasing

Every `@pepreviewpro/*` package is published from this repository's `release.yml` workflow, through npm trusted publishing. GitHub Actions proves who it is to npm with a short-lived OIDC token, so no npm token, and no personal access token, is stored anywhere. Each release carries npm provenance, which links the published version to the commit and workflow run that built it.

This file is not published. It is for whoever owns the npm org.

## How a release happens

1. Each pull request that changes a package adds a changeset: run `pnpm changeset`, pick the bump, and write a line for the changelog. All packages share one version.
2. When that lands on `main`, `release.yml` opens or updates a pull request called **Version Packages**. It bumps every version, writes each package's `CHANGELOG.md`, and deletes the changesets.
3. Merging **Version Packages** runs `release.yml` again. It finds the versions npm does not have yet, then runs lint, typecheck, tests, the build, the size budgets, the snippet check, and the tarball check.
4. `pnpm release:publish` packs each package with pnpm, which rewrites `workspace:*` to real versions. It checks every tarball and refuses to publish any of them if one carries a source map, a test, or source files, lacks `README.md`, `AGENTS.md`, or `LICENSE`, or names another repository. Then it runs `npm publish --provenance --access public` for each package, dependencies first, and tags `@pepreviewpro/<name>@<version>`.
5. Changesets pushes the tags and creates a GitHub release for each package.

Every step is safe to run again. A version already on npm is skipped, so a run that stopped halfway finishes on a re-run.

Before merging **Version Packages**, run `pnpm codegen` against the API's latest endpoint export, as `.agents/rules/compatibility.md` asks.

### The Version Packages pull request and CI

GitHub does not start workflows for a pull request that a workflow opened with its own token. So CI does not run on **Version Packages** by itself, though `release.yml` runs every check again before it publishes. If `main` requires CI to pass before a merge, close the pull request and reopen it. A reopen by a person starts CI.

## One-time setup

Do these in order. Steps 3 to 6 are once per package, for all seven: `core`, `server`, `browser`, `react`, `next`, `ai`, and `cli`.

### 1. GitHub

- The repository is public, at `pepreviewpro/pepreviewpro-sdk`. Provenance needs a public repository. From a private one, npm publishes no provenance, and `--provenance` fails the publish on purpose, so the READMEs never claim provenance a version lacks.
- In **Settings**, **Actions**, **General**, under **Workflow permissions**, tick **Allow GitHub Actions to create and approve pull requests**. Without it, Changesets cannot open **Version Packages**.
- No secrets are needed. If an npm token or a personal access token was ever saved as a repository secret, delete it.

### 2. npm account

Turn on two-factor authentication for your npm account. Publishing by hand and `npm trust` both need it.

### 3. Publish each package once, by hand

npm lets you add a trusted publisher only to a package that already exists. So the first version of each package goes up from your machine, with 2FA, and the token npm issues for it is revoked straight after.

```sh
git clone https://github.com/pepreviewpro/pepreviewpro-sdk.git
cd pepreviewpro-sdk
pnpm install --frozen-lockfile
pnpm build
pnpm pack:check --out ../pepreviewpro-release

npm login --auth-type=web
for tarball in ../pepreviewpro-release/*/*.tgz; do npm publish "$tarball" --access public; done
npm logout
```

`pnpm pack:check` prints each tarball's files and fails if one is not fit to ship. npm asks for your second factor on each publish. `npm logout` revokes the session token `npm login` saved, so no token is left on your machine or anywhere else. These first versions have no provenance, since they were not built in GitHub Actions. Every later one does.

Skip this step for a package that is already on npm.

### 4. Add the trusted publisher

On npmjs.com, open the package, then **Settings**, then **Trusted Publisher**, and choose **GitHub Actions**:

| Field                | Value              |
| -------------------- | ------------------ |
| Organization or user | `pepreviewpro`     |
| Repository           | `pepreviewpro-sdk` |
| Workflow filename    | `release.yml`      |
| Environment name     | leave empty        |

Every field is case-sensitive. The workflow filename is the file name only, not its path. Or, with npm 11.15.0 or later:

```sh
npm trust github @pepreviewpro/core --repo pepreviewpro/pepreviewpro-sdk --file release.yml
```

npm expects a new trusted publisher to publish within two days. Add them just before you merge the first **Version Packages** pull request. If more than two days pass, delete the trusted publisher and add it again.

### 5. Publish the first version through the workflow

Merge **Version Packages**. On npmjs.com, each new version should show a provenance badge that links back to the workflow run.

### 6. Disallow tokens

Once a package has published through the workflow, open its **Settings**, then **Publishing access**, and choose **Require two-factor authentication and disallow tokens**. Trusted publishing keeps working, since it uses OIDC rather than a token, and no leaked token can ever publish the package. Then revoke any npm access tokens that remain on your account.

## When a publish fails

| What you see                          | Why, usually                                                                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENEEDAUTH`, "Unable to authenticate" | The workflow filename on npmjs.com is not exactly `release.yml`, or the trusted publisher was never added.                                                                                           |
| A 404 or 403 on `npm publish`         | The package has no trusted publisher yet, or its two days lapsed. See step 4.                                                                                                                        |
| A provenance error                    | `repository.url` in the package's `package.json` is not exactly `git+https://github.com/pepreviewpro/pepreviewpro-sdk.git`, or the repository is private. `test/manifests.test.ts` checks the first. |
| `Trusted publishing needs npm 11.5.1` | The runner's npm is too old. The workflow installs npm 11 first; check that step ran.                                                                                                                |
| "Nothing was published", with a list  | A tarball check failed. Nothing went out. Fix it and merge again.                                                                                                                                    |

Re-run the failed workflow once the cause is fixed. Versions that made it to npm are skipped.

## What npm requires, and where it says so

- Trusted publishing needs npm 11.5.1 or later and Node 22.14.0 or later, `id-token: write` in the workflow, and a GitHub-hosted runner: [npm docs, trusted publishers](https://docs.npmjs.com/trusted-publishers).
- Provenance is automatic under trusted publishing for a public package from a public repository, and not supported from a private one: [the same page](https://docs.npmjs.com/trusted-publishers). `repository.url` must match the repository exactly.
- A package must exist on npm before it can have a trusted publisher: [npm docs, `npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust).
