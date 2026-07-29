import { NextResponse } from "next/server";

import { clearCurrentEmail } from "@/lib/session";

export const runtime = "nodejs";

/** Drop the email that keys the dashboard. Called as part of signing out. */
export async function DELETE() {
  await clearCurrentEmail();
  return NextResponse.json({ ok: true });
}
