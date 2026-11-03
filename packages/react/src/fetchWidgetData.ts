import { PepReviewProClient, refQuery, type ExternalId, type WidgetData } from "@pepreviewpro/core";

interface Query {
	baseUrl: string;
	store: string;
	productRef?: ExternalId | undefined;
	limit?: number | undefined;
}

/** In-flight and finished reads, so every widget on a page that shows the same reviews shares one request. */
const reads = new Map<string, Promise<WidgetData>>();

/** One store's public `widget-data`, fetched once per page for the same query. A failed read is forgotten so it can be retried. */
export function fetchWidgetData({ baseUrl, store, productRef, limit }: Query): Promise<WidgetData> {
	const key = JSON.stringify([baseUrl, store, productRef ?? null, limit ?? null]);
	const known = reads.get(key);
	if (known) {
		return known;
	}

	const read = new PepReviewProClient({ baseUrl })
		.widgetData({ site_id: store, ...refQuery("product", productRef), ...(limit === undefined ? {} : { limit }) })
		.then(({ store: profile, settings, reviews, aggregate }) => ({ store: profile, settings, reviews, aggregate }));
	reads.set(key, read);
	read.catch(() => reads.delete(key));
	return read;
}
