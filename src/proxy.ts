import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic sign in check for private areas. It only looks for the session
 * cookie, so it is fast and never touches the database. Pages and actions
 * still verify the session and role on the server (see src/server/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Private areas only. Static assets, images and API routes never reach the proxy.
  matcher: ["/account/:path*", "/trips/:path*", "/saved/:path*", "/host/:path*", "/admin/:path*"],
};
