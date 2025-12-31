import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_FILE_EXTENSION_REGEX = /\.(?:ico|jpe?g|png|svg|gif|webp)$/i;

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isApiRoute = pathname.startsWith("/api");

	// Allow common static assets to be served without authentication unless the
	// request targets the API surface.
	if (PUBLIC_FILE_EXTENSION_REGEX.test(pathname) && !isApiRoute) {
		return NextResponse.next();
	}

	/*
	 * Playwright starts the dev server and requires a 200 status to
	 * begin the tests, so this ensures that the tests can start
	 */
	if (pathname.startsWith("/ping")) {
		return new Response("pong", { status: 200 });
	}

	if (pathname.startsWith("/api/auth")) {
		return NextResponse.next();
	}

	// Allow WhatsApp webhook (uses X-Twilio-Signature for auth)
	if (
		pathname.startsWith("/api/whatsapp") ||
		pathname.startsWith("/api/sentry-test")
	) {
		return NextResponse.next();
	}

	const authSecret = process.env["AUTH_SECRET"];
	const token = await getToken({
		req: request,
		secureCookie: !isDevelopmentEnvironment,
		...(authSecret ? { secret: authSecret } : {}),
	});

	if (!token) {
		if (PUBLIC_ROUTES.has(pathname)) {
			return NextResponse.next();
		}

		const loginUrl = new URL("/login", request.url);
		const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

		if (requestedPath && requestedPath !== "/login") {
			loginUrl.searchParams.set("redirectUrl", requestedPath);
		}

		return NextResponse.redirect(loginUrl);
	}

	if (token && PUBLIC_ROUTES.has(pathname)) {
		const redirectParam = request.nextUrl.searchParams.get("redirectUrl");
		const redirectTarget = redirectParam?.startsWith("/") ? redirectParam : "/";

		return NextResponse.redirect(new URL(redirectTarget, request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/",
		"/chat/:id",
		"/api/:path*",
		"/login",

		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
	],
};
