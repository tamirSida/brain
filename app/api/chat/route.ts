import { NextResponse } from "next/server";
import { z } from "zod";

import { hasApiKey } from "@/lib/ai/client";
import { respond, titleFrom } from "@/lib/chat/respond";
import { listConversations, readConversation, writeConversation } from "@/lib/chat/store";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";
import type { ChatMessage, Conversation } from "@/lib/chat/types";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60s and does not allow raising it.
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().nullable(),
  message: z.string().trim().min(1).max(4000),
  voice: z.boolean().optional(),
});

/** GET — list this user's threads, or load one. */
export async function GET(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const convo = await readConversation(id);
    if (!convo || convo.email !== email.toLowerCase()) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ conversation: convo });
  }
  return NextResponse.json({ conversations: await listConversations(email) });
}

export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });

  const session = await readSession(email);
  if (!session) return NextResponse.json({ error: "no profile" }, { status: 401 });

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — chat needs an active key." },
      { status: 503 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { conversationId, message, voice } = parsed.data;
  const now = new Date().toISOString();

  let convo: Conversation | null = conversationId
    ? await readConversation(conversationId)
    : null;

  if (convo && convo.email !== email.toLowerCase()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!convo) {
    convo = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      title: titleFrom(message),
      messages: [],
      summary: null,
      summarizedUpTo: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    ts: now,
    ...(voice ? { voice: true } : {}),
  };
  convo.messages.push(userMsg);

  try {
    const { reply, compacted, windowSize } = await respond(convo, session.profile);
    convo.messages.push(reply);
    convo.updatedAt = new Date().toISOString();
    await writeConversation(convo);

    return NextResponse.json({
      conversationId: convo.id,
      title: convo.title,
      user: userMsg,
      reply,
      // Surfaced in the UI so context handling is visible, not magic.
      context: {
        compacted,
        windowSize,
        totalMessages: convo.messages.length,
        summarized: convo.summarizedUpTo,
        hasSummary: Boolean(convo.summary),
      },
    });
  } catch (err) {
    console.error("[chat]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
