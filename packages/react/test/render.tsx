import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; container: HTMLElement }[] = [];

afterEach(() => {
	for (const { root, container } of mounted.splice(0)) {
		act(() => root.unmount());
		container.remove();
	}

	document.head.querySelectorAll("script").forEach((script) => script.remove());
});

/** Renders into a fresh container on the page and returns it. */
export async function render(element: ReactNode): Promise<HTMLElement> {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	mounted.push({ root, container });
	await act(async () => root.render(element));
	return container;
}

/** Lets pending fetches resolve and their state updates land. */
export async function settle(): Promise<void> {
	await act(async () => {
		for (let turn = 0; turn < 5; turn++) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
}

/** Records every element IntersectionObserver is asked to watch. */
export function observeIntersections(): Element[] {
	const watched: Element[] = [];
	globalThis.IntersectionObserver = class {
		observe(element: Element) {
			watched.push(element);
		}
		disconnect() {}
		unobserve() {}
		takeRecords() {
			return [];
		}
	} as unknown as typeof IntersectionObserver;
	return watched;
}
