# Security

Email security reports to support@pepreviewpro.com. Put "Security" in the subject, and include the package, the version, and how to reproduce the problem. Please do not post details anywhere public until we have answered.

Issues and pull requests are closed on this repository, so email is the only channel, for security reports and bugs alike.

## Supported versions

Fixes go into the latest release of each `@pepreviewpro/*` package. Upgrade to it to get them.

## If a key leaks

PepReviewPro keys are secret, including older ones that start with `pk_live_`. If one reaches a browser bundle, a repository, or a log, revoke it in the PepReviewPro dashboard, create a new one, and set it on your server. `npx @pepreviewpro/cli doctor` scans a client build for keys.

## Verifying a release

Releases are published from this repository's GitHub Actions through npm trusted publishing, with provenance. On npmjs.com, a version's provenance links to the commit and the workflow run that built it. `npm audit signatures` checks the provenance of what you have installed.
