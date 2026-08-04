import "server-only";

import { z } from "zod";

import { structuredCall, toJsonSchema } from "./client";
import { buildMetric, normaliseMetric } from "./metric";
import { type Metric } from "./schemas";
import { systemPrompt } from "@/lib/chat/respond";
import type { Profile } from "@/lib/types";

/**
 * One turn of the phone remote.
 *
 * Questions and board edits go through the same call, with the same history,
 * because the interesting flow crosses between them:
 *
 *     "כמה רכבים החברה מחכירה?"  → "47 רכבים…"
 *     "תוסיף את זה ללוח"          → adds a 47-vehicle metric
 *
 * A mode switch would make that second sentence ambiguous — "add what?" — and
 * routing questions and edits to separate endpoints would mean the edit never
 * sees the answer it is referring to. One call, one thread.
 *
 * Two calls, not one. Folding the metric into a single structured response
 * meant the model built a whole chart object just to answer "how many cars do
 * we lease" — measured at 55s, which is unusable when someone is standing in
 * front of a screen. The intent call is small and fast; the metric is only
 * generated when the turn actually changes the board.
 */

/** First call: what did the user mean, and what do we say back. No chart. */
const IntentSchema = z.object({
  /**
   * answer — reply only, the board is untouched.
   * add / remove / replace — mutate the board.
   */
  intent: z.enum(["answer", "add", "remove", "replace"]),
  /** For remove/replace: the exact `id` from the board list. Empty otherwise. */
  targetId: z.string(),
  /**
   * What to show on the phone: the answer itself for `answer`, or a one-line
   * confirmation for an edit.
   */
  reply: z.string(),
  /**
   * For add/replace: one line naming the metric to build and the figures it
   * should carry, drawn from the conversation. This is what lets "add that to
   * the dashboard" inherit the number from the answer above it.
   */
  spec: z.string(),
});

const RULES = `
אתה מפעיל שלט מהטלפון עבור לוח המדדים של ״אלמוגים״.
כל הודעה היא או שאלה או בקשה לשנות את הלוח. הכרע לפי ההקשר, כולל השיחה שקדמה.

intent:
- answer — המשתמש שאל שאלה. אל תיגע בלוח. reply הוא התשובה עצמה, קצרה:
  עד ארבעה משפטים או חמש נקודות, מתאים למסך טלפון. spec = "".
- add — המשתמש מבקש מדד חדש. targetId = "".
- remove — המשתמש מבקש להסיר מדד. targetId = ה-id המדויק מרשימת הלוח. spec = "".
- replace — המשתמש מבקש להחליף מדד קיים. targetId = הישן.

**הקשר**: אם המשתמש שאל שאלה ואז אמר ״תוסיף את זה ללוח״ / ״תוסיף לדשבורד״,
ה-spec חייב לשאת את המספרים שכבר נתת בתשובה — לא נושא חדש.
דוגמה: לשאלה ״כמה רכבים החברה מחכירה?״ ענית ״47 רכבים, ₪312 אלף לחודש״;
spec יהיה ״רכבים בליסינג — 47 רכבים, עלות חודשית ₪312 אלף״.

reply לעריכה: משפט אחד בגוף ראשון, למשל ״הוספתי רכבים בליסינג ללוח.״`;

export interface TurnResult {
  intent: "answer" | "add" | "remove" | "replace";
  /** Present only when the board changed. */
  metrics: Metric[] | null;
  reply: string;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export async function runTurn(
  text: string,
  history: HistoryTurn[],
  current: Metric[],
  profile: Profile
): Promise<TurnResult> {
  const list = current.length
    ? current.map((m) => `- ${m.id} · ${m.title} (${m.viz}) — ${m.value}`).join("\n")
    : "(הלוח ריק)";

  const conversation = history.length
    ? history.map((h) => `${h.role === "user" ? "משתמש" : "עוזר"}: ${h.content}`).join("\n")
    : "(אין שיחה קודמת)";

  // The full chat grounding — calendar, mail, connected systems — so a question
  // asked from the phone is answered from the same data as one asked at the
  // desk, rather than from a thinner prompt that disclaims more.
  const decision = await structuredCall({
    system: `${systemPrompt(profile)}\n${RULES}`,
    prompt: [
      "המדדים שכרגע על הלוח:",
      list,
      "",
      "השיחה עד כה:",
      conversation,
      "",
      "ההודעה החדשה:",
      text,
    ].join("\n"),
    schema: IntentSchema,
    jsonSchema: toJsonSchema(IntentSchema),
    maxTokens: 2500,
  });

  if (decision.intent === "answer") {
    return { intent: "answer", metrics: null, reply: decision.reply };
  }

  if (decision.intent === "remove") {
    const next = current.filter((m) => m.id !== decision.targetId);
    // A removal that matched nothing is a failed instruction, not a no-op.
    if (next.length === current.length) {
      return { intent: "answer", metrics: null, reply: "לא מצאתי מדד כזה על הלוח." };
    }
    return { intent: "remove", metrics: next, reply: decision.reply };
  }

  // Second call, only for turns that actually build something.
  const built = await buildMetric(
    decision.spec || text,
    current.map((m) => m.id)
  );
  const metric = normaliseMetric(built, current.map((m) => m.id));

  if (decision.intent === "replace") {
    const idx = current.findIndex((m) => m.id === decision.targetId);
    if (idx === -1) return { intent: "add", metrics: [...current, metric], reply: decision.reply };
    const next = [...current];
    next[idx] = metric;
    return { intent: "replace", metrics: next, reply: decision.reply };
  }

  return { intent: "add", metrics: [...current, metric], reply: decision.reply };
}
