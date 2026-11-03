import type { ReactNode } from "react";

export const metadata = { title: "Compare stores" };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<a href="#main-content">Skip to content</a>
				{children}
			</body>
		</html>
	);
}
