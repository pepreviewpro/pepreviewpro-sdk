// @vitest-environment jsdom
import type { WidgetData, WidgetDataResponse } from "@pepreviewpro/core";
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureCase, replayFetch } from "../../../test/replay";
import * as react from "../src";
import { Carousel, PepReviewProProvider, ProductStars, ReviewWall, TrustBadge, useAggregate, useReviews, type WidgetProps } from "../src";
import { WIDGET_CATALOG, type WidgetType } from "../src/widgetCatalog";
import { observeIntersections, render, settle } from "./render";

const recorded = fixtureCase("widget-data-product-ref", "one product by the store's own id");
const response = recorded.response.body as WidgetDataResponse;
const data: WidgetData = { store: response.store, settings: response.settings, reviews: response.reviews, aggregate: response.aggregate };
const componentName = (type: WidgetType) => WIDGET_CATALOG[type].replaceAll(" ", "");
const exported = react as unknown as Record<string, ComponentType<WidgetProps> | undefined>;
const runtimeTypes = (Object.keys(WIDGET_CATALOG) as WidgetType[]).filter((type) => type !== "form");
const payloadOf = (container: HTMLElement) =>
	JSON.parse(container.querySelector("[data-pepreviews-widget]")!.getAttribute("data-pepreviews-widget")!);

beforeEach(() => {
	document.cookie.split(";").forEach((pair) => (document.cookie = `${pair.split("=")[0]?.trim()}=; Max-Age=0; Path=/`));
});

describe("widget catalog", () => {
	it.each(Object.keys(WIDGET_CATALOG) as WidgetType[])("names the %s component after its dashboard widget", (type) => {
		expect(exported[componentName(type)]?.name).toBe(componentName(type));
	});
});

describe("widgets", () => {
	it.each(runtimeTypes)("prints the runtime's host for %s, in the plugin's payload shape", async (type) => {
		const Widget = exported[componentName(type)]!;
		const container = await render(<Widget data={data} limit={3} link={false} />);
		const host = container.querySelector("[data-pepreviews-widget]")!;
		expect(host.className).toBe("pepreviews-widget");
		expect(payloadOf(container)).toEqual({
			type,
			options: { limit: 3, link: false },
			data: { app_url: "https://pepreviewpro.com", store: data.store, settings: data.settings, reviews: data.reviews, aggregate: data.aggregate }
		});
	});

	it("renders the reviews into the server HTML as a visually hidden copy inside the host", () => {
		const html = renderToString(<Carousel data={data} />);
		const page = new DOMParser().parseFromString(html, "text/html");
		const copy = page.querySelector("[data-pepreviews-widget] > [data-prp-fallback]")!;
		expect(copy.getAttribute("style")).toMatch(/position:absolute;width:1px;height:1px/);
		const minimum = data.settings!.min_rating_display;
		for (const review of data.reviews) {
			expect(copy.textContent!.includes(review.body)).toBe(review.rating >= minimum);
		}

		expect(copy.textContent).toContain(`from ${data.aggregate.total} reviews`);
	});

	it("leaves star-only reviews out of the copy", () => {
		const [first, ...rest] = data.reviews.filter((review) => review.rating >= data.settings!.min_rating_display);
		const html = renderToString(<Carousel data={{ ...data, reviews: [{ ...first!, body: " " }, ...rest] }} limit={1} />);
		const page = new DOMParser().parseFromString(html, "text/html");
		const copy = page.querySelector("[data-prp-fallback]")!;
		expect(copy.textContent).toContain(rest[0]!.body);
		expect(copy.textContent).not.toContain(first!.reviewer_name);
	});

	it("lists no reviews in the copy of a widget that shows only the rating", () => {
		const html = renderToString(<TrustBadge data={data} />);
		expect(html).not.toContain("data-prp-reviews");
		expect(html).toContain("out of 5 from");
	});

	it("loads the runtime once from the provider's base URL, and marks the reviews seen when on screen", async () => {
		const watched = observeIntersections();
		const container = await render(
			<PepReviewProProvider store="magnolia-store" baseUrl="http://localhost:4010/">
				<Carousel data={data} />
				<ReviewWall data={data} theme="dark" />
			</PepReviewProProvider>
		);
		const scripts = [...document.head.querySelectorAll("script")];
		expect(scripts.map((script) => script.src)).toEqual(["http://localhost:4010/embed/widgets.js"]);
		expect(watched).toEqual([...container.querySelectorAll("[data-pepreviews-widget]")]);
	});

	it("shows the plain copy when the runtime cannot load", async () => {
		const container = await render(
			<PepReviewProProvider baseUrl="https://unreachable.example">
				<Carousel data={data} />
			</PepReviewProProvider>
		);
		const script = document.head.querySelector("script")!;
		script.dispatchEvent(new Event("error"));
		await settle();
		expect(container.querySelector<HTMLElement>("[data-prp-fallback]")!.style.position).toBe("");
	});

	it("passes the provider's theme unless the widget sets its own", async () => {
		const container = await render(
			<PepReviewProProvider theme="auto">
				<TrustBadge data={data} />
			</PepReviewProProvider>
		);
		expect(payloadOf(container).options.theme).toBe("auto");
	});

	it("fetches public widget-data for a store, once for widgets that show the same reviews", async () => {
		const { fetch, requests } = replayFetch(recorded);
		vi.stubGlobal("fetch", fetch);
		const container = await render(
			<PepReviewProProvider store="magnolia-store">
				<Carousel productRef="sku-101" limit={20} />
				<ProductStars productRef="sku-101" limit={20} />
			</PepReviewProProvider>
		);
		await settle();
		expect(requests).toHaveLength(1);
		const expected = new URLSearchParams(recorded.request.query);
		expected.set("limit", "50");
		expect(requests[0]?.url.search).toBe(`?${expected}`);
		expect(container.querySelectorAll("[data-pepreviews-widget]")).toHaveLength(2);
		expect(payloadOf(container).data.reviews).toEqual(data.reviews);
	});
});

describe("headless hooks", () => {
	function Summary() {
		const { reviews, loading } = useReviews({ store: "example-store" });
		const { aggregate } = useAggregate({ store: "example-store" });
		return <p>{loading ? "loading" : `${reviews.length} of ${aggregate?.total}`}</p>;
	}

	it("read the same data and apply the store's minimum rating", async () => {
		const byStore = fixtureCase("get-widget-data", "by slug, with the store's minimum rating applied");
		const body = byStore.response.body as WidgetDataResponse;
		const { fetch, requests } = replayFetch(byStore);
		vi.stubGlobal("fetch", fetch);
		expect(renderToString(<Summary />)).toContain("loading");
		const container = await render(<Summary />);
		await settle();
		const shown = body.reviews.filter((review) => review.rating >= body.settings!.min_rating_display).length;
		expect(container.textContent).toBe(`${shown} of ${body.aggregate.total}`);
		expect(requests).toHaveLength(1);
	});

	it("list what the widgets list, trimmed to the limit", async () => {
		const [first, ...rest] = data.reviews;
		function Names() {
			const { reviews } = useReviews({ data: { ...data, reviews: [{ ...first!, body: "" }, ...rest] }, limit: 1 });
			return <p>{reviews.map((review) => review.reviewer_name).join(", ")}</p>;
		}

		const container = await render(<Names />);
		expect(container.textContent).toBe(rest.find((review) => review.rating >= data.settings!.min_rating_display)!.reviewer_name);
	});

	it("say what is missing without a store", async () => {
		function Missing() {
			return <p>{useReviews().error?.message}</p>;
		}

		const container = await render(<Missing />);
		expect(container.textContent).toMatch(/Pass store/);
	});
});

describe("provider", () => {
	it("records the shopper's first touch on mount", async () => {
		window.history.replaceState({}, "", "/?prp_click_id=abc&utm_source=pepreviewpro");
		await render(<PepReviewProProvider store="magnolia-store" />);
		expect(decodeURIComponent(document.cookie)).toContain('"utm_source":"pepreviewpro"');
	});

	it("records nothing without consent", async () => {
		window.history.replaceState({}, "", "/?prp_click_id=abc");
		await render(<PepReviewProProvider store="magnolia-store" consent={false} />);
		expect(document.cookie).not.toContain("prp_attribution");
	});
});
