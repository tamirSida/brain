import { NextResponse } from "next/server";

import { readBoard } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The board's current state, polled by the desktop dashboard.
 *
 * Polling rather than a Firestore listener on purpose: the store falls back to
 * an in-memory map whenever Firestore is unreachable, and onSnapshot would go
 * silent exactly then — during a demo, on someone else's network.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const session = await readBoard(boardId);
  if (!session) return NextResponse.json({ error: "board not found" }, { status: 404 });

  // Bounded: a crashed request would otherwise leave the dashboard claiming
  // an edit is arriving forever.
  const pending = session.pendingSince ? Date.parse(session.pendingSince) : 0;
  const receiving = pending > 0 && Date.now() - pending < 90_000;

  return NextResponse.json(
    {
      receiving,
      metrics: session.brief.metrics,
      layout: session.profile.layout ?? null,
      owner: session.profile.name,
      title: session.profile.title,
      updatedAt: session.updatedAt,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
