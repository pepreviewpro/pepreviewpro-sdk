"use client";
import { useActionState } from "react";
import { placeOrder } from "./placeOrder";

export function Checkout({ slug }: { slug: string }) {
	const [message, action, pending] = useActionState(placeOrder, null);
	return (
		<form action={action}>
			<input type="hidden" name="slug" value={slug} />
			<label htmlFor="checkout-email">Email</label>
			<input id="checkout-email" name="email" type="email" autoComplete="email" required defaultValue="buyer@example.com" />
			<button type="submit" disabled={pending}>
				Place order
			</button>
			<p role="status">{message}</p>
		</form>
	);
}
