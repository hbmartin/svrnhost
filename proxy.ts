import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoutes = ["/login"];

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

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    if (publicRoutes.includes(pathname)) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", request.url);
    const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (requestedPath && requestedPath !== "/login") {
      loginUrl.searchParams.set("redirectUrl", requestedPath);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (token && publicRoutes.includes(pathname)) {
    const redirectParam = request.nextUrl.searchParams.get("redirectUrl");
    const redirectTarget =
      redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";

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
    "/register",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
