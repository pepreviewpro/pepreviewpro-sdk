/*
 * A stand-in for https://pepreviewpro.com/embed/widgets.js with the same host contract: it reads each
 * `data-pepreviews-widget` payload, attaches an open shadow root, and renders into `[data-widget-mount]`, mounting
 * hosts added later too. The real runtime's rendering is tested in the app.
 */
globalThis.PepReviewProWidgets = (function () {
	var mounted = new WeakSet();
	function mount(host) {
		if (mounted.has(host)) {
			return;
		}

		mounted.add(host);
		var payload = JSON.parse(host.getAttribute("data-pepreviews-widget"));
		var shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
		var root = document.createElement("div");
		root.setAttribute("data-widget-mount", "");
		root.className = "pep-widget";
		root.setAttribute("data-widget-type", payload.type);
		root.textContent = payload.data.store.name + ": " + payload.data.aggregate.total + " reviews";
		shadow.appendChild(root);
	}

	function mountAll(scope) {
		scope.querySelectorAll("[data-pepreviews-widget]").forEach(mount);
	}

	mountAll(document);
	new MutationObserver(function (records) {
		records.forEach(function (record) {
			record.addedNodes.forEach(function (node) {
				if (node.nodeType === 1) {
					if (node.hasAttribute("data-pepreviews-widget")) {
						mount(node);
					}

					mountAll(node);
				}
			});
		});
	}).observe(document.documentElement, { childList: true, subtree: true });
	return { mount: mount };
})();
