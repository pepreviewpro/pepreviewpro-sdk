import { signWebhook } from "@pepreviewpro/server";
import type { Io } from "../io";
import { loadEnv } from "../loadEnv";

const SECRET = /^whsec_[A-Za-z0-9+/]+={0,2}$/;

/**
 * Sends a signed `ping` to the store's webhook route, the way PepReviewPro delivers one, and says whether the route
 * accepted it. Exits 1 unless it answered 2xx.
 */
export async function webhooksTest(
	io: Io,
	url: string | undefined,
	flags: { store?: string | undefined; secret?: string | undefined }
): Promise<number> {
	if (!url || !/^https?:\/\//.test(url)) {
		io.err("Pass the route's URL: `pepreviewpro webhooks test http://localhost:3000/api/pepreviewpro`.");
		return 1;
	}

	const env = await loadEnv(io);
	const secret = flags.secret ?? env.webhookSecret;
	const store = flags.store ?? env.store;
	if (!secret || !SECRET.test(secret)) {
		io.err("Pass --secret, or set PEPREVIEWPRO_WEBHOOK_SECRET, to the endpoint's whsec_ secret from the dashboard.");
		return 1;
	}

	if (!store) {
		io.err("Pass --store, or set PEPREVIEWPRO_STORE, to your store's slug.");
		return 1;
	}

	const body = JSON.stringify({ type: "ping", timestamp: new Date(io.now()).toISOString(), data: { store } });
	const headers = await signWebhook({ secret, body, timestamp: Math.floor(io.now() / 1000) });
	let response: Response;
	try {
		response = await (io.fetch ?? fetch)(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
	} catch (error) {
		io.err(`Could not reach ${url}: ${(error as Error).message}`);
		return 1;
	}

	if (response.ok) {
		io.out(`${url} accepted a signed ping with ${response.status}.`);
		return 0;
	}

	io.err(
		response.status === 401
			? `${url} refused the signature (401). Check that the route's PEPREVIEWPRO_WEBHOOK_SECRET is this endpoint's secret.`
			: `${url} answered ${response.status}. A webhook route should answer 2xx to a ping.`
	);
	return 1;
}
