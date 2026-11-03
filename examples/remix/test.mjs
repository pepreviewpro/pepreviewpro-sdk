/**
 * Renders the built app's home page in-process, against the replay server `pnpm examples:test` starts, and checks
 * the reviews and their JSON-LD are in the server HTML.
 */
import assert from "node:assert/strict";
import { createRequestHandler } from "react-router";

const build = await import("./build/server/index.js");
const response = await createRequestHandler(build, "production")(new Request("http://localhost/"));
const html = await response.text();
assert.equal(response.status, 200);
assert.match(html, /data-pepreviews-widget=/);
assert.match(html, /<article>.*?data-prp-review-body="">/s);
assert.match(html, /<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"Product"/);
console.log("remix: reviews and JSON-LD are in the server HTML.");
