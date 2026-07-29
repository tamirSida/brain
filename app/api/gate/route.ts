import { NextResponse } from "next/server";
import { z } from "zod";

import { GATE_COOKIE, GATE_MAX_AGE, gateToken } from "@/lib/gate";

export const runtime = "nodejs";

const Body = z.object({ password: z.string() });

/**
 * Exchange the shared password for the access cookie.
 *
 * Deliberately stores nothing: there is no account to create and no record
 * that anyone entered. The cookie is the entire result.
 */
export async function POST(req: Request) {
  const token = await gateToken();
  if (!token) return NextResponse.json({ ok: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  if (parsed.data.password.trim() !== process.env.DEMO_PASSWORD?.trim()) {
    // A deliberate pause: a demo password is short, and this is the only thing
    // standing between a public URL and the prototype.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
