One exported function per file, named exactly after the function: `parseRetryAfter` → `packages/core/src/parseRetryAfter.ts`, `clientIp` → `packages/server/src/clientIp.ts`. Classes, constants, and types follow their own sense of grouping: an error class or a client class may sit alone or beside its option types.

- Private helpers may stay unexported in the same file. When a second file needs one, give it its own file.
- Each package has one `src/index.ts` that lists its public API. That is the only barrel. Inside a package, import from the function's own path.
- A package imports another only through its published name (`@pepreviewpro/core`), never by relative path, so the built packages resolve the same way the tests do.

## Public API

Everything `src/index.ts` exports is public and versioned. Removing or renaming an export, a parameter, or a field of a returned object is a breaking change: a major version once a package is 1.0, and a changeset that says so before then.

## Dependencies

`@pepreviewpro/browser` has none and stays under 3 kB gzipped; `pnpm size` and `packages/browser/test/size.test.ts` enforce it. The other packages depend only on each other. Anything else needs the owner's yes.
