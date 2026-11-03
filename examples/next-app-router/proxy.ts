import { withPepReviewPro } from "@pepreviewpro/next/proxy";

export const proxy = withPepReviewPro();

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
