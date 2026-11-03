/** Checks the static build has the reviews and their JSON-LD in its HTML. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./dist/index.html", import.meta.url), "utf8");
assert.match(html, /data-pepreviews-widget=/);
assert.match(html, /<ul data-prp-reviews="">.*?<article>/s);
const markup = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.equal(markup["@type"], "Product");
assert.ok(markup.aggregateRating.reviewCount > 0);
console.log("astro: reviews and JSON-LD are in the built HTML.");
