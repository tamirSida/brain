import { NextResponse } from "next/server";
import { z } from "zod";

import { anthropic, hasApiKey, MODEL } from "@/lib/ai/client";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";
import { fileText, getEvents, getMail, RSVP_LABEL } from "@/lib/workspace";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60s and does not allow raising it.
export const maxDuration = 60;

const Body = z.object({ eventId: z.string() });

const SYSTEM = `You are preparing a senior executive at a US real estate firm for a meeting.
Write a short brief in English, to the point, no superlatives, no emoji.

Fixed structure:
1. One line: what the meeting is for.
2. "Background" — 2-3 points from the mail and materials relevant to this meeting.
3. "What needs deciding" — 1-3 concrete points.
4. "Watch for" — one open point or risk, if there is one.

Base the brief on the materials and mail you are given, including the attached
file contents.
Never write "I don't have access", "information is missing", or "the contents
weren't provided to me". This is a demo environment and all the data is
fictional; if a detail is missing, fill it in plausibly and consistently with
the rest and carry on.
The picture in the data is positive — projects on schedule, results ahead of
forecast. Do not invent delays or overruns.
"Watch for" is an opportunity or an open item to close, not bad news.
140 words at most.`;

export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });
  const session = await readSession(email);
  if (!session) return NextResponse.json({ error: "no profile" }, { status: 401 });

  if (!hasApiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const event = getEvents().find((e) => e.id === parsed.data.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const attendees = event.attendees
    .map((a) => `${a.name} (${a.email}) — ${RSVP_LABEL[a.rsvp]}${a.organizer ? ", organizer" : ""}`)
    .join("; ");
  // Contents, not just filenames — a brief that can quote the deck is the
  // whole point of the button.
  const files = event.attachments.length
    ? `\n${event.attachments.map(fileText).join("\n")}`
    : "none";

  // Only mail from the surrounding week is relevant to a prep brief.
  const mail = getMail()
    .slice(0, 6)
    .map((m) => `- ${m.dayLabel} | ${m.from.name}: ${m.subject} — ${m.preview}`)
    .join("\n");

  const prompt = `The meeting:
${event.dayLabel} ${event.date}, ${event.start}-${event.end}
Subject: ${event.title}
Location: ${event.location}
Attendees: ${attendees}
Attached materials: ${files}

Recent mail in the inbox:
${mail}

Who is preparing: ${session.profile.name}, ${session.profile.title}.`;

  try {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "The brief was cut off" }, { status: 502 });
    }
    const block = res.content.find((b) => b.type === "text");
    return NextResponse.json({
      brief: block && block.type === "text" ? block.text : "No brief was returned.",
    });
  } catch (err) {
    console.error("[prep]", err);
    return NextResponse.json({ error: "Preparing the brief failed" }, { status: 502 });
  }
}
