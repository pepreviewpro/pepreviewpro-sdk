const KEY = /^(pk|sk)_live_[A-Za-z0-9]{40}$/;

/** `store` for an `sk_live_` store key, `owner` for a `pk_live_` key, null when it is neither. */
export function keyKind(key: string): "store" | "owner" | null {
	const prefix = key.trim().match(KEY)?.[1];
	return prefix === "sk" ? "store" : prefix === "pk" ? "owner" : null;
}
