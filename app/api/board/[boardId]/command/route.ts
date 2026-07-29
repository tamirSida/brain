import { NextResponse } from "next/server";
import { z } from "zod";

import { applyCommand } from "@/lib/ai/command";
import { hasApiKey } from "@/lib/ai/client";
import { readBoard, writeSession } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ text: z.string().trim().min(2, "לא הבנתי את הבקשה") });

/**
 * Spoken edit from the phone. No auth: possession of the board id — which only
 * comes from scanning the QR on the screen — is the credential.
 */
export async function POST(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const session = await readBoard(boardId);
  if (!session) return NextResponse.json({ error: "הלוח לא נמצא" }, { status: 404 });

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

  try {
    const result = await applyCommand(parsed.data.text, session.brief.metrics, session.profile);

    await writeSession({
      ...session,
      brief: { ...session.brief, metrics: result.metrics },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      action: result.action,
      reply: result.reply,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error("[board command]", err);
    return NextResponse.json({ error: "העדכון נכשל. נסה לנסח אחרת." }, { status: 502 });
  }
}
