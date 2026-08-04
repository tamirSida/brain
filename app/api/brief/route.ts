import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBrief } from "@/lib/ai/brief";
import { LAYOUTS } from "@/lib/layouts";
import { hasApiKey } from "@/lib/ai/client";
import { currentEmail } from "@/lib/session";
import { readSession, writeSession } from "@/lib/store";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60s and does not allow raising it.
export const maxDuration = 60;

const Body = z.object({
  focus: z.string().trim().min(12, "Say a little more about what matters to you"),
  layout: z.enum(LAYOUTS).optional(),
});

/** Regenerate the three metrics from a new instruction. */
export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });

  const session = await readSession(email);
  if (!session) return NextResponse.json({ error: "no profile" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const profile = {
    ...session.profile,
    focus: parsed.data.focus,
    layout: parsed.data.layout ?? session.profile.layout,
  };

  // Changing only the layout is a rearrangement, not a new question — don't
  // spend a model call (or change the numbers under the user) for it.
  if (parsed.data.focus === session.profile.focus) {
    await writeSession({ ...session, profile, updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, regenerated: false });
  }

  if (!hasApiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }

  try {
    const brief = await buildBrief(profile);
    await writeSession({
      ...session,
      profile,
      brief,
      source: "model",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, regenerated: true });
  } catch (err) {
    console.error("[brief]", err);
    return NextResponse.json({ error: "Building the board failed. Try again." }, { status: 502 });
  }
}
