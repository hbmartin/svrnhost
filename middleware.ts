import { auth } from "@/app/(auth)/auth";

export default auth((req) => {
	const isLoggedIn = !!req.auth;
	const { pathname } = req.nextUrl;

	// Allow public API routes (webhook endpoints with their own auth)
	if (pathname.startsWith("/api/whatsapp")) {
		return undefined;
	}

	// Allow auth-related routes
	if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
		return undefined;
	}

	// Redirect unauthenticated users to login
	if (!isLoggedIn) {
		const loginUrl = new URL("/login", req.nextUrl.origin);
		loginUrl.searchParams.set("redirectUrl", pathname);
		return Response.redirect(loginUrl);
	}

	return undefined;
});

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 * - Public assets (images, etc.)
		 */
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
	],
};
