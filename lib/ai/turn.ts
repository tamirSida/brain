import "server-only";

import { z } from "zod";

import { structuredCall, toJsonSchema } from "./client";
import { MetricSchema, type Metric } from "./schemas";
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
 * The model always fills `metric`; on an answer it is ignored. That wastes a
 * few hundred tokens per question and saves a second round trip on every edit,
 * which is the trade that matters when someone is watching a wall screen.
 */

const TurnSchema = z.object({
  /**
   * answer — reply only, the board is untouched.
   * add / remove / replace — mutate the board.
   */
  intent: z.enum(["answer", "add", "remove", "replace"]),
  /** For remove/replace: the exact `id` from the board list. Empty otherwise. */
  targetId: z.string(),
  /** The new metric for add/replace. Ignored for answer and remove. */
  metric: MetricSchema,
  /**
   * What to show on the phone: the answer itself for `answer`, or a one-line
   * confirmation for an edit.
   */
  reply: z.string(),
});

const RULES = `
אתה מפעיל שלט מהטלפון עבור לוח המדדים של ״אופק אחזקות״.
כל הודעה היא או שאלה או בקשה לשנות את הלוח. הכרע לפי ההקשר, כולל השיחה שקדמה.

intent:
- answer — המשתמש שאל שאלה. אל תיגע בלוח. reply הוא התשובה עצמה, קצרה:
  עד ארבעה משפטים או חמש נקודות, מתאים למסך טלפון.
- add — המשתמש מבקש מדד חדש. targetId = "".
- remove — המשתמש מבקש להסיר מדד. targetId = ה-id המדויק מרשימת הלוח.
- replace — המשתמש מבקש להחליף מדד קיים. targetId = הישן, metric = החדש.

**הקשר**: אם המשתמש שאל שאלה ואז אמר ״תוסיף את זה ללוח״ / ״תוסיף לדשבורד״,
בנה את המדד מתוך התשובה שנתת קודם — אותם מספרים, אותו נושא. אל תמציא נושא חדש.
דוגמה: לשאלה ״כמה רכבים החברה מחכירה?״ ענית ״47 רכבים״; ״תוסיף ללוח״ יוצר
מדד בשם ״רכבים בליסינג״ עם value ״47״.

כשה-intent הוא answer, מלא את metric בערכי מציין מקום כלשהם — הוא לא ייעשה בו שימוש.

כללים למדד חדש:
- id: slug באנגלית, אותיות קטנות ומקפים, שלא קיים כבר ברשימה.
- title: תווית עברית קצרה, עד ארבע מילים.
- viz לפי סוג הנתון:
  · number — ערך בודד בלי מגמה
  · line — מגמה לאורך זמן (5–8 נקודות)
  · bar — השוואה בין פריטים (3–6)
  · donut — התפלגות ל-2 עד 4 חלקים
  · progress — התקדמות מול יעד (נקודה אחת, 0–100)
- value מעוצב ומוכן לתצוגה, כולל ₪ / % / M לפי העניין.
- insight: משפט עברי אחד, עובדתי.
- נתוני הדגמה חיוביים: delta חיובי, trend הוא "ok" או "neutral".
- אל תשכפל מדד שכבר קיים; אם הבקשה דומה לקיים, בחר replace.
- reply לעריכה: משפט אחד בגוף ראשון, למשל ״הוספתי רכבים בליסינג ללוח.״`;

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

  // The full chat grounding — calendar, mail, connected systems — so a question
  // asked from the phone is answered from the same data as one asked at the
  // desk, rather than from a thinner prompt that disclaims more.
  const system = `${systemPrompt(profile)}\n${RULES}`;

  const conversation = history.length
    ? history.map((h) => `${h.role === "user" ? "משתמש" : "עוזר"}: ${h.content}`).join("\n")
    : "(אין שיחה קודמת)";

  const prompt = [
    "המדדים שכרגע על הלוח:",
    list,
    "",
    "השיחה עד כה:",
    conversation,
    "",
    "ההודעה החדשה:",
    text,
  ].join("\n");

  const turn = await structuredCall({
    system,
    prompt,
    schema: TurnSchema,
    jsonSchema: toJsonSchema(TurnSchema),
    maxTokens: 6000,
  });

  if (turn.intent === "answer") {
    return { intent: "answer", metrics: null, reply: turn.reply };
  }

  if (turn.intent === "remove") {
    const next = current.filter((m) => m.id !== turn.targetId);
    // A removal that matched nothing is a failed instruction, not a no-op.
    if (next.length === current.length) {
      return { intent: "answer", metrics: null, reply: "לא מצאתי מדד כזה על הלוח." };
    }
    return { intent: "remove", metrics: next, reply: turn.reply };
  }

  const metric = normalise(turn.metric, current);

  if (turn.intent === "replace") {
    const idx = current.findIndex((m) => m.id === turn.targetId);
    if (idx === -1) return { intent: "add", metrics: [...current, metric], reply: turn.reply };
    const next = [...current];
    next[idx] = metric;
    return { intent: "replace", metrics: next, reply: turn.reply };
  }

  return { intent: "add", metrics: [...current, metric], reply: turn.reply };
}

/**
 * Reconcile the generated metric to something renderable, and guarantee its id
 * is unique — a duplicate would collide with an existing card's React key.
 */
function normalise(m: Metric, current: Metric[]): Metric {
  const series = (m.series ?? []).filter((p) => Number.isFinite(p.value));

  let viz = m.viz;
  if (series.length === 0) viz = "number";
  else if (viz === "line" && series.length < 3) viz = "bar";

  let points = series;
  if (viz === "donut" && series.length > 4) {
    const sorted = [...series].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const rest = sorted.slice(3).reduce((sum, p) => sum + Math.abs(p.value), 0);
    points = [...sorted.slice(0, 3), { label: "אחר", value: rest }];
  }
  if (viz === "bar" && series.length > 6) points = series.slice(0, 6);
  if (viz === "progress" && series.length) {
    const raw = series[0].value;
    const pct = raw > 0 && raw < 1 ? raw * 100 : raw;
    points = [{ ...series[0], value: Math.max(0, Math.min(100, pct)) }];
  }
  if (viz === "number") points = [];

  const taken = new Set(current.map((x) => x.id));
  let id = m.id?.trim() || "metric";
  while (taken.has(id)) id = `${id}-2`;

  return { ...m, id, viz, series: points };
}
