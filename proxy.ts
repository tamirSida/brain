import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { GATE_COOKIE, GATE_MAX_AGE, GATE_PARAM, gateToken, tokensMatch } from "@/lib/gate";

/**
 * Guards the whole prototype behind one shared password.
 *
 * Runs before any route renders, so there is no window where an ungated page
 * is served. It checks a cookie and nothing else — no session lookup, no
 * database — which keeps it cheap and keeps site access completely separate
 * from the email-keyed session the app itself uses.
 */
export async function proxy(request: NextRequest) {
  const token = await gateToken();
  // No password configured — the gate is off.
  if (!token) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;

  // The gate itself must stay reachable, or there is no way in.
  if (pathname === "/gate" || pathname === "/api/gate") return NextResponse.next();

  if (tokensMatch(request.cookies.get(GATE_COOKIE)?.value, token)) {
    return NextResponse.next();
  }

  // A scanned QR carries the token, so the phone is admitted without anyone
  // typing a password mid-demo. Redirect to strip it from the URL afterwards:
  // the token should live in a cookie, not in browser history or a screenshot.
  if (tokensMatch(searchParams.get(GATE_PARAM) ?? undefined, token)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(GATE_PARAM);
    const res = NextResponse.redirect(clean);
    res.cookies.set(GATE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: GATE_MAX_AGE,
    });
    return res;
  }

  // API calls get a status, not a redirect to an HTML page they can't parse.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "נדרשת סיסמה" }, { status: 401 });
  }

  const gate = request.nextUrl.clone();
  gate.pathname = "/gate";
  gate.search = "";
  // Come back to whatever was asked for — a scanned board link included.
  gate.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(gate);
}

export const config = {
  /**
   * Everything except Next's own build output and static files in /public.
   * Those carry no data and excluding them keeps the gate off the hot path
   * for every asset on the page.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
