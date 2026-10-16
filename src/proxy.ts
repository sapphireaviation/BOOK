import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const KEY_FILE = /^\/([A-Za-z0-9-]{8,128})\.txt$/;

/**
 * Three jobs:
 * 1. Optimistic sign in check for private areas. It only looks for the
 *    session cookie, so it is fast and never touches the database. Pages and
 *    actions still verify the session and role on the server.
 * 2. Serves the IndexNow key file at /<INDEXNOW_KEY>.txt.
 * 3. Serves the sitemap index at /sitemap.xml. Next.js keeps that path for
 *    app/sitemap.ts, which with generateSitemaps only answers /sitemap/<id>.xml.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/sitemap.xml") return NextResponse.rewrite(new URL("/.well-known/sitemap-index", request.url));

  const keyFile = KEY_FILE.exec(pathname);
  if (keyFile) {
    const key = process.env.INDEXNOW_KEY?.trim();
    if (key && keyFile[1] === key) return NextResponse.rewrite(new URL("/.well-known/indexnow", request.url));
    return NextResponse.next();
  }

  if (getSessionCookie(request)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // The sitemap index, private areas and top level .txt files only. Static assets, images and API routes never reach the proxy.
  matcher: ["/sitemap.xml", "/account/:path*", "/trips/:path*", "/saved/:path*", "/host/:path*", "/admin/:path*", "/:file([A-Za-z0-9-]{8,128}\\.txt)"],
};
