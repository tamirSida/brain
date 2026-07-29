import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBrief } from "@/lib/ai/brief";
import { hasApiKey } from "@/lib/ai/client";
import { currentEmail } from "@/lib/session";
import { readSession, writeSession } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  focus: z.string().trim().min(12, "פרט קצת יותר מה חשוב לך"),
});

/** Regenerate the three metrics from a new instruction. */
export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });

  const session = await readSession(email);
  if (!session) return NextResponse.json({ error: "no profile" }, { status: 401 });

  if (!hasApiKey()) {
    return NextResponse.json({ error: "חסר ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" },
      { status: 400 }
    );
  }

  const profile = { ...session.profile, focus: parsed.data.focus };

  try {
    const brief = await buildBrief(profile);
    await writeSession({
      ...session,
      profile,
      brief,
      source: "model",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[brief]", err);
    return NextResponse.json({ error: "בניית המסך נכשלה. נסה שוב." }, { status: 502 });
  }
}
