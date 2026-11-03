import { getAggregate } from "@pepreviewpro/next/cache-components";
import Link from "next/link";
import { PRODUCTS } from "../lib/catalog";

export default async function Home() {
	const aggregate = await getAggregate();
	return (
		<main id="main-content">
			<h1>Magnolia Store</h1>
			<p>
				Rated {aggregate.score.toFixed(1)} out of 5 from {aggregate.total} reviews.
			</p>
			<nav aria-label="Products">
				<ul>
					{Object.entries(PRODUCTS).map(([slug, product]) => (
						<li key={slug}>
							<Link href={`/products/${slug}`}>{product.name}</Link>
						</li>
					))}
				</ul>
			</nav>
		</main>
	);
}
