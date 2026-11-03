/** The public GitHub repository every package's `repository` field names. npm's trusted publishing and provenance both require it to match exactly. */
export const REPOSITORY_URL = "git+https://github.com/pepreviewpro/pepreviewpro-sdk.git";

/** What every published tarball must carry, so the npm page and node_modules both explain the package. */
export const REQUIRED_FILES = ["package.json", "README.md", "AGENTS.md", "LICENSE"] as const;
