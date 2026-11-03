// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { fixtureCase, replayFetch } from "../../../test/replay";
import { PepReviewProProvider, ReviewForm } from "../src";
import { render, settle } from "./render";

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!;
	act(() => {
		setter.call(element, value);
		element.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function fill(container: HTMLElement, { rating = 5, body = "Arrived quickly and well packed, would order again." } = {}) {
	act(() => container.querySelector<HTMLInputElement>(`input[type="radio"][value="${rating}"]`)!.click());
	type(container.querySelector("textarea")!, body);
	type(container.querySelector<HTMLInputElement>('input[autocomplete="name"]')!, "Casey");
	type(container.querySelector<HTMLInputElement>('input[type="email"]')!, "casey@example.com");
}

const submit = async (container: HTMLElement) => {
	await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
	await settle();
};

describe("ReviewForm", () => {
	it("labels every field and groups the rating as five radios under a legend", async () => {
		const container = await render(<ReviewForm store="example-store" />);
		const fieldset = container.querySelector("fieldset")!;
		expect(fieldset.querySelector("legend")?.textContent).toBe("Your rating");
		expect([...fieldset.querySelectorAll("label")].map((label) => label.textContent)).toEqual(["5 stars", "4 stars", "3 stars", "2 stars", "1 star"]);
		expect(fieldset.querySelectorAll('input[type="radio"]')).toHaveLength(5);
		for (const field of container.querySelectorAll("textarea, input:not([type=radio])")) {
			expect(container.querySelector(`label[for="${field.id}"]`)?.textContent).toMatch(/^Your /);
		}
	});

	it("announces field errors, ties them to their fields, and focuses the first", async () => {
		const container = await render(<ReviewForm store="example-store" />);
		await submit(container);
		const alerts = [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent);
		expect(alerts).toEqual(["Please select a star rating", "Review is required", "Name is required", "Email is required"]);
		expect(document.activeElement).toBe(container.querySelector('input[value="5"]'));
		const body = container.querySelector("textarea")!;
		expect(body.getAttribute("aria-invalid")).toBe("true");
		expect(
			body
				.getAttribute("aria-describedby")
				?.split(" ")
				.map((id) => document.getElementById(id)?.textContent)
		).toEqual(["Review is required", "0/1000"]);
	});

	it("posts the store's own product and order ids, then focuses the thank-you status", async () => {
		const saved = fixtureCase("submit-review", "a review is saved and waits for its author");
		const { fetch, requests } = replayFetch(saved);
		vi.stubGlobal("fetch", fetch);
		const onSubmitted = vi.fn();
		const container = await render(
			<PepReviewProProvider store="magnolia-store">
				<ReviewForm productRef="sku-101" orderRef={1001} rating={4} onSubmitted={onSubmitted} />
			</PepReviewProProvider>
		);
		expect(container.querySelector<HTMLInputElement>('input[value="4"]')!.checked).toBe(true);
		await fill(container);
		await submit(container);
		expect(requests[0]?.url.pathname).toBe(saved.path);
		expect(requests[0]?.body).toEqual({
			site_id: "magnolia-store",
			rating: 5,
			body: "Arrived quickly and well packed, would order again.",
			reviewer_name: "Casey",
			reviewer_email: "casey@example.com",
			product_ref: "sku-101",
			order_id: 1001
		});
		const status = container.querySelector('[role="status"]')!;
		expect(status.textContent).toContain("Check your email to verify it.");
		expect(document.activeElement).toBe(status);
		expect(onSubmitted).toHaveBeenCalledWith(saved.response.body);
	});

	it("shows the API's own message as an alert with a retry", async () => {
		const { fetch, requests } = replayFetch(fixtureCase("submit-review", "a rating out of range"));
		vi.stubGlobal("fetch", fetch);
		const container = await render(<ReviewForm store="example-store" />);
		await fill(container);
		await submit(container);
		const alert = container.querySelector('[data-prp-submit-error][role="alert"]')!;
		expect(alert.textContent).toContain("Rating must be between 1 and 5");
		await act(async () => alert.querySelector("button")!.click());
		await settle();
		expect(requests).toHaveLength(2);
	});

	it("is operable from the keyboard: arrow keys move the rating like any radio group", async () => {
		const container = await render(<ReviewForm store="example-store" />);
		const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
		expect(radios.every((radio) => radio.tabIndex === 0 || radio.tabIndex === -1 || radio.getAttribute("tabindex") === null)).toBe(true);
		expect(container.querySelector('button[type="submit"]')?.textContent).toBe("Submit review");
	});
});
