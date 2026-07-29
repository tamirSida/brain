import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBrief } from "@/lib/ai/brief";
import { DEFAULT_LAYOUT, LAYOUTS } from "@/lib/layouts";
import { hasApiKey } from "@/lib/ai/client";
import { demoBrief } from "@/lib/ai/demo";
import { setCurrentEmail } from "@/lib/session";
import { linkBoard, newBoardId, writeSession } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  name: z.string().trim().min(2, "שם קצר מדי"),
  email: z.email("כתובת הדוא״ל אינה תקינה"),
  title: z.string().trim().min(2, "תפקיד קצר מדי"),
  focus: z.string().trim().min(12, "עוד קצת פירוט יעזור"),
  layout: z.enum(LAYOUTS).default(DEFAULT_LAYOUT),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" },
      { status: 400 }
    );
  }

  const profile = parsed.data;

  try {
    // No key configured → deterministic sample brief, so the mock is clickable
    // out of the box. With a key set, the model generates this.
    const live = hasApiKey();
    const brief = live ? await buildBrief(profile) : demoBrief();
    const now = new Date().toISOString();

    const boardId = newBoardId();
    await linkBoard(boardId, profile.email);

    await writeSession({
      email: profile.email,
      boardId,
      profile,
      brief,
      source: live ? "model" : "demo",
      createdAt: now,
      updatedAt: now,
    });

    await setCurrentEmail(profile.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboard]", err);
    return NextResponse.json(
      { error: "בניית המסך נכשלה. נסה שוב בעוד רגע." },
      { status: 502 }
    );
  }
}
