import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE, verifyIdToken } from "@/lib/auth/token";

export const runtime = "nodejs";

const Body = z.object({ idToken: z.string().min(20) });

/**
 * Exchange a verified Firebase ID token for an httpOnly cookie.
 *
 * The browser holds the token too, but JavaScript-readable storage can't guard
 * a server-rendered page — the cookie is what lets the proxy decide before any
 * HTML is produced. The token is verified here rather than trusted, so a
 * forged one never reaches the cookie in the first place.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const identity = await verifyIdToken(parsed.data.idToken);
  if (!identity) {
    return NextResponse.json({ error: "That sign-in is not valid" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, email: identity.email });
  res.cookies.set(AUTH_COOKIE, parsed.data.idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Firebase ID tokens last an hour; the client refreshes this before then.
    maxAge: 60 * 60,
  });
  return res;
}

/** Sign out: drop the cookie. The client clears its own Firebase session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
