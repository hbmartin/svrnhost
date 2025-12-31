import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_FILE_EXTENSION_REGEX = /\.(?:ico|jpe?g|png|svg|gif|webp)$/i;

function isPublicStaticAsset(pathname: string, isApiRoute: boolean): boolean {
	return PUBLIC_FILE_EXTENSION_REGEX.test(pathname) && !isApiRoute;
}

function isExemptApiRoute(pathname: string): boolean {
	return (
		pathname.startsWith("/api/auth") ||
		pathname.startsWith("/api/whatsapp") ||
		pathname.startsWith("/api/sentry-test")
	);
}

function buildLoginRedirectUrl(request: NextRequest): URL {
	const loginUrl = new URL("/login", request.url);
	const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

	if (requestedPath && requestedPath !== "/login") {
		loginUrl.searchParams.set("redirectUrl", requestedPath);
	}

	return loginUrl;
}

function getAuthenticatedRedirectTarget(request: NextRequest): string {
	const redirectParam = request.nextUrl.searchParams.get("redirectUrl");
	return redirectParam?.startsWith("/") ? redirectParam : "/";
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isApiRoute = pathname.startsWith("/api");

	if (isPublicStaticAsset(pathname, isApiRoute)) {
		return NextResponse.next();
	}

	if (pathname.startsWith("/ping")) {
		return new Response("pong", { status: 200 });
	}

	if (isExemptApiRoute(pathname)) {
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
		return NextResponse.redirect(buildLoginRedirectUrl(request));
	}

	if (PUBLIC_ROUTES.has(pathname)) {
		const redirectTarget = getAuthenticatedRedirectTarget(request);
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
