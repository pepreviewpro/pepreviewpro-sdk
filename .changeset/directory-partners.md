---
"@pepreviewpro/core": minor
"@pepreviewpro/server": minor
"@pepreviewpro/next": minor
"@pepreviewpro/ai": minor
---

Directory partners: sites and assistants that list PepReviewPro stores.

- `@pepreviewpro/ai`, a new package: `createFindVendorsTool(partner, options)` for the AI SDK 7, with `describeFindVendorsResult`, `findVendors`, and `FIND_VENDORS_INSTRUCTIONS`. It relaxes filters that match nothing and says which, reports stores the directory lacks, and returns tracked links only.
- `@pepreviewpro/server`: `PepReviewProPartner`, with `stores.list`, `products.list`, `reviews.list`, `vendorMiss.report`, `events.report`, `links.click`, and `me()`. Reads return camelCase DTOs (`DirectoryStore`, `DirectoryProduct`, `DirectoryReview`) whose links to use are `clickUrl` and `profileUrl`; the untracked ones are `websiteUrl` and `pageUrl`.
- `@pepreviewpro/next`: `getDirectoryStores`, `getDirectoryProducts`, and `getDirectoryReviews` in both entries, cached for five minutes under `DIRECTORY_CACHE_TAG`, `pepreviewpro:directory`.
- `@pepreviewpro/core`: `stores`, `products`, `reviews`, `vendorMiss`, `partnerEvents`, and `me` on `PepReviewProClient`, with their wire types (`ApiStore`, `ApiProduct`, `ApiReview`, and the rest).
