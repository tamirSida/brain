import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE, verifyIdToken } from "@/lib/auth/token";

/**
 * Requires a signed-in Firebase user before any route renders.
 *
 * The cookie is verified, not merely present: the token is checked against
 * Google's published signing keys, for this project, and for expiry. Anyone can
 * set a cookie; nobody can forge one that survives that.
 *
 * Runs before rendering, so there is no window in which a protected page is
 * produced for an unauthenticated request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The way in has to stay open, or there is no way in.
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  /**
   * The phone remote is deliberately exempt. It is reached by scanning a QR
   * off the dashboard — which only someone already signed in can display — and
   * the unguessable board id in the URL is its credential. Requiring a Firebase
   * login on a handset mid-demo would defeat the point of the handoff.
   *
   * The trade is real: a leaked board link works for anyone who has it. See
   * the README.
   */
  if (pathname.startsWith("/r/") || pathname.startsWith("/api/board/")) {
    return NextResponse.next();
  }

  if (await verifyIdToken(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on, not HTML they can't parse. 401
  // also tells the client to refresh its token and retry.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except Next's own build output and static media in /public,
   * which carry no data. Video matters here beyond tidiness: a media file is
   * fetched as a stream of byte ranges, and verifying a JWT on every one of
   * them would be wasted work on an asset that is not secret.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff2?)$).*)",
  ],
};
