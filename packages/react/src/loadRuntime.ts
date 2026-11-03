const loads = new Map<string, Promise<void>>();

/**
 * Adds the widget runtime's script to the page once per URL. A page that already has it, from the store's own tag
 * or another widget, is left alone: the runtime mounts hosts added later by itself.
 */
export function loadRuntime(src: string): Promise<void> {
	const known = loads.get(src);
	if (known) {
		return known;
	}

	const load = new Promise<void>((resolve, reject) => {
		if ([...document.scripts].some((script) => script.src === src)) {
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Could not load the PepReviewPro widget runtime from ${src}.`));
		document.head.appendChild(script);
	});
	loads.set(src, load);
	load.catch(() => loads.delete(src));
	return load;
}
