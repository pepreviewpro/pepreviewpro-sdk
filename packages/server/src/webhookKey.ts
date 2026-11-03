import { decodeBase64 } from "./decodeBase64";
import { WebhookVerificationError } from "./WebhookVerificationError";

const SECRET_PREFIX = "whsec_";

/** The HMAC key a `whsec_` secret holds: the base64 after the prefix. The prefix is optional. */
export async function webhookKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
	const encoded = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret;
	try {
		return await globalThis.crypto.subtle.importKey("raw", decodeBase64(encoded), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
	} catch {
		throw new WebhookVerificationError("The webhook secret is not valid base64.");
	}
}
