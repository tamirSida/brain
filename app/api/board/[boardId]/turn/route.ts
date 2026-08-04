import { NextResponse } from "next/server";
import { z } from "zod";

import { hasApiKey } from "@/lib/ai/client";
import { runTurn } from "@/lib/ai/turn";
import { readBoard, writeSession } from "@/lib/store";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60s and does not allow raising it.
export const maxDuration = 60;

/** How many phone turns the board keeps. */
const MAX_TURNS = 12;

const Body = z.object({
  text: z.string().trim().min(2, "I didn't catch that"),
  /** Recent turns, replayed by the phone so follow-ups resolve. */
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(24)
    .optional(),
});

/**
 * One turn from the phone: a question or a board edit, decided by the model.
 *
 * No auth. Possession of the board id is the credential, and the only way to
 * get it is to be in the room looking at the screen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const session = await readBoard(boardId);
  if (!session) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  if (!hasApiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Announce before the slow part so the dashboard reacts while the model is
  // still working, not only once it finishes. The question goes up with it, so
  // the room can read what was asked while the answer is still being written.
  //
  // Capped at MAX_TURNS: this rides along in every session write, and a phone
  // left open on a table would otherwise grow the document without limit.
  const turnId = crypto.randomUUID();
  const priorTurns = (session.phoneTurns ?? []).slice(-(MAX_TURNS - 1));
  await writeSession({
    ...session,
    pendingSince: new Date().toISOString(),
    phoneTurns: [...priorTurns, { id: turnId, question: parsed.data.text, at: new Date().toISOString() }],
  });

  try {
    const result = await runTurn(
      parsed.data.text,
      // Bounded: a phone left open on a table shouldn't grow an unbounded prompt.
      (parsed.data.history ?? []).slice(-10),
      session.brief.metrics,
      session.profile
    );

    await writeSession({
      ...session,
      brief: result.metrics
        ? { ...session.brief, metrics: result.metrics }
        : session.brief,
      pendingSince: null,
      // Patch the answer onto the entry already on the board, rather than
      // appending — otherwise the question appears twice.
      phoneTurns: [
        ...priorTurns,
        { id: turnId, question: parsed.data.text, answer: result.reply, at: new Date().toISOString() },
      ],
      // Only bump the clock on a real change, so the dashboard's poll doesn't
      // treat an answered question as a board update.
      updatedAt: result.metrics ? new Date().toISOString() : session.updatedAt,
    });

    return NextResponse.json({
      ok: true,
      intent: result.intent,
      reply: result.reply,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error("[board turn]", err);
    // Clear the marker, or the dashboard claims an edit is arriving until it
    // times out.
    // Drop the unanswered question rather than leaving it stranded on the
    // board with a spinner that will never resolve.
    await writeSession({ ...session, pendingSince: null, phoneTurns: priorTurns });
    return NextResponse.json({ error: "That request failed. Try wording it differently." }, { status: 502 });
  }
}
