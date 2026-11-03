import { Carousel, PepReviewProProvider, ReviewsJsonLd } from "@pepreviewpro/react";
import { PepReviewPro } from "@pepreviewpro/server";
import { useLoaderData } from "react-router";

const STORE = "magnolia-store";

export function meta() {
	return [{ title: "Magnolia Store reviews" }];
}

/** Runs on the server, so the reviews are in the HTML. `@pepreviewpro/server` reads PEPREVIEWPRO_BASE_URL for staging. */
export async function loader() {
	const reviews = await new PepReviewPro({ store: STORE, heartbeat: false }).reviews.list({ productRef: "sku-101", limit: 20 });
	return { reviews, baseUrl: process.env.PEPREVIEWPRO_BASE_URL };
}

export default function Home() {
	const { reviews, baseUrl } = useLoaderData<typeof loader>();
	return (
		<PepReviewProProvider store={STORE} baseUrl={baseUrl}>
			<main id="main-content">
				<ReviewsJsonLd data={reviews} product={{ name: "BPC-157 10mg", url: "https://store.example/products/sku-101" }} />
				<h1>BPC-157 10mg</h1>
				<Carousel data={reviews} />
			</main>
		</PepReviewProProvider>
	);
}
