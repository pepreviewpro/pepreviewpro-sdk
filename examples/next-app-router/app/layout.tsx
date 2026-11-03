import { PepReviewProProvider } from "@pepreviewpro/react";
import type { ReactNode } from "react";

export const metadata = { title: "Magnolia Store" };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<a href="#main-content">Skip to content</a>
				<PepReviewProProvider store={process.env.PEPREVIEWPRO_STORE} baseUrl={process.env.PEPREVIEWPRO_BASE_URL}>
					{children}
				</PepReviewProProvider>
			</body>
		</html>
	);
}
