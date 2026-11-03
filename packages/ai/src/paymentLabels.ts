import type { PaymentMethod } from "@pepreviewpro/server";

/** How each payment method reads in a sentence, from the app's `lib/enums/site.ts` labels. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
	card: "Card",
	crypto: "Crypto",
	bankTransfer: "Bank transfer",
	zelle: "Zelle",
	cashApp: "Cash App",
	venmo: "Venmo",
	paypal: "PayPal",
	other: "Other"
};
