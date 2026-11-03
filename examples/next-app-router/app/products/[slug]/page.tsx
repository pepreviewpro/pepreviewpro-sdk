import { getReviews, ReviewsJsonLd } from "@pepreviewpro/next/cache-components";
import { Carousel, ProductStars, ReviewForm } from "@pepreviewpro/react";
import { notFound } from "next/navigation";
import { PRODUCTS, STORE_URL, type ProductSlug } from "../../../lib/catalog";
import { Checkout } from "./Checkout";

export function generateStaticParams() {
	return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	if (!(slug in PRODUCTS)) {
		notFound();
	}

	const product = PRODUCTS[slug as ProductSlug];
	const reviews = await getReviews({ productRef: slug });
	return (
		<main id="main-content">
			<ReviewsJsonLd data={reviews} product={{ name: product.name, url: `${STORE_URL}/products/${slug}`, image: product.image, productRef: slug }} />
			<h1>{product.name}</h1>
			<ProductStars data={reviews} />
			<p>${product.price.toFixed(2)}</p>
			<section aria-labelledby="checkout-title">
				<h2 id="checkout-title">Checkout</h2>
				<Checkout slug={slug} />
			</section>
			<section aria-labelledby="reviews-title">
				<h2 id="reviews-title">Reviews</h2>
				<Carousel data={reviews} />
			</section>
			<section aria-labelledby="write-title">
				<h2 id="write-title">Write a review</h2>
				<ReviewForm productRef={slug} />
			</section>
		</main>
	);
}
