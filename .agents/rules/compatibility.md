The SDK talks only to `https://pepreviewpro.com/api/v1`. The API's paths, parameters, response fields, and error codes are frozen on the app's side, and they bind the SDK too: it never depends on a field, parameter, or error string that the API's published endpoint reference does not document.

- Branch on an error's `code`, from `API_ERROR_CODES` in `packages/core/src/errors.ts`, never on its message. `API_ERRORS` mirrors the documented messages word for word, for tests and the public endpoints, which send no code.
- Request and response types use the API's own snake_case names. The server package's options use camelCase; it maps between them in one place per shape.
- A test that needs an API response uses a fixture in `test/fixtures/`, never a hand-built body inline, unless the case is one no recording can cover, like a 503.
- `pnpm codegen` must pass against the latest export of the API's endpoint reference before a release.
- Fixtures, examples, and docs use fictional data only: the store `example-store` ("Example Store"), the domains `store.example` and `example.com`, addresses at `example.com`, IPs from `203.0.113.0/24` and `2001:db8::/32`, and ids like `ORD-1001` and `sku-123`. Never a real store, person, domain, or review.
