import { getDirectoryStores } from "@pepreviewpro/next";
import { after } from "next/server";
import { partner } from "../lib/partner";

const DEFAULT_COMPOUND = "bpc-157";

export default async function Directory({ searchParams }: { searchParams: Promise<{ compound?: string }> }) {
	const compound = (await searchParams).compound?.trim() || DEFAULT_COMPOUND;
	const { stores } = await getDirectoryStores({ compound, sort: "best", limit: 12 });
	// The read above may come from the cache, which the API never sees, so report what this page shows.
	after(() =>
		partner.events.report(stores.map((store) => ({ type: "shown" as const, store: store.slug, compound, placement: "finderStore" as const })))
	);
	return (
		<main id="main-content">
			<h1>Stores that sell {compound}</h1>
			{stores.length === 0 ? (
				<p role="status">No store in the directory lists {compound}.</p>
			) : (
				<ul>
					{stores.map((store) => {
						const product = store.matchedProducts?.find((match) => match.inStock) ?? store.matchedProducts?.[0];
						return (
							<li key={store.slug}>
								<h2>
									<a href={store.clickUrl ?? store.profileUrl}>{store.name}</a>
								</h2>
								<p>
									Rated {store.rating.toFixed(1)} out of 5 from {store.reviewCount} reviews. <a href={store.profileUrl}>Read its reviews</a>
								</p>
								{product?.clickUrl ? (
									<p>
										<a href={product.clickUrl}>{product.name}</a>, {product.inStock ? "in stock" : "out of stock"}
									</p>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</main>
	);
}
