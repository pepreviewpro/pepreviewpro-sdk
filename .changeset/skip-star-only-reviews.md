---
"@pepreviewpro/react": minor
---

Widgets that list reviews, and `useReviews`, now skip reviews with stars but no text, as the dashboard's widgets do. Those reviews still count toward the rating. Every widget and hook on a page now shares one read of the full page of reviews, and `limit` trims what each one shows, so skipped reviews never leave a widget short.
