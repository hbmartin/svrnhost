import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_FILE_EXTENSION_REGEX = /\.(?:ico|jpe?g|png|svg|gif|webp)$/i;
const REQUEST_ID_HEADER = "x-request-id";

/**
 * Generate a unique request ID for correlation.
 * Format: req_<timestamp_base36>_<random_base36>
 */
function generateRequestId(): string {
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

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

/**
 * Create a NextResponse with request ID injected.
 */
function nextWithRequestId(request: NextRequest): NextResponse {
	const requestId =
		request.headers.get(REQUEST_ID_HEADER) ??
		request.headers.get("x-vercel-id") ??
		generateRequestId();

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(REQUEST_ID_HEADER, requestId);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});

	response.headers.set(REQUEST_ID_HEADER, requestId);
	return response;
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isApiRoute = pathname.startsWith("/api");

	if (isPublicStaticAsset(pathname, isApiRoute)) {
		return nextWithRequestId(request);
	}

	if (pathname.startsWith("/ping")) {
		return new Response("pong", { status: 200 });
	}

	// Inject request ID for API routes even if exempt from auth
	if (isExemptApiRoute(pathname)) {
		return nextWithRequestId(request);
	}

	// Add health endpoints to exempt routes
	if (pathname.startsWith("/api/health")) {
		return nextWithRequestId(request);
	}

	const authSecret = process.env["AUTH_SECRET"];
	const token = await getToken({
		req: request,
		secureCookie: !isDevelopmentEnvironment,
		...(authSecret ? { secret: authSecret } : {}),
	});

	if (!token) {
		if (PUBLIC_ROUTES.has(pathname)) {
			return nextWithRequestId(request);
		}
		return NextResponse.redirect(buildLoginRedirectUrl(request));
	}

	if (PUBLIC_ROUTES.has(pathname)) {
		const redirectTarget = getAuthenticatedRedirectTarget(request);
		return NextResponse.redirect(new URL(redirectTarget, request.url));
	}

	return nextWithRequestId(request);
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
