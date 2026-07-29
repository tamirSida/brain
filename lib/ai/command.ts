import "server-only";

import { z } from "zod";

import { structuredCall, toJsonSchema } from "./client";
import { MetricSchema, type Metric } from "./schemas";
import { connectors } from "@/lib/connectors";
import type { Profile } from "@/lib/types";

/**
 * Spoken dashboard editing.
 *
 * One structured call turns a sentence like "תוסיף תזרים חודשי" into an action
 * on the board. The model decides the intent *and* produces the metric in the
 * same call — a separate classify-then-generate round trip would double the
 * latency on the one interaction the demo is built around.
 */

const CommandSchema = z.object({
  /** add — new metric · remove — drop one · replace — swap one for a new one. */
  action: z.enum(["add", "remove", "replace"]),
  /**
   * For remove/replace: the `id` of the metric being targeted, copied exactly
   * from the list given in the prompt. Empty string when adding.
   */
  targetId: z.string(),
  /** The new metric, for add and replace. Ignored for remove. */
  metric: MetricSchema,
  /** One short Hebrew sentence confirming what was done, for the phone. */
  reply: z.string(),
});

const SYSTEM = `אתה עורך את לוח המדדים של ״אופק אחזקות״ — חברת נדל״ן ואחזקות ישראלית.
המשתמש מדבר אליך מהטלפון ומבקש שינוי בלוח. תרגם את הבקשה לפעולה אחת.

הפעולות:
- add — המשתמש רוצה מדד חדש. הפק מדד מלא. targetId = "".
- remove — המשתמש רוצה להסיר מדד קיים. targetId = ה-id המדויק מהרשימה.
  את השדה metric מלא בערכי מציין מקום כלשהם; הוא לא ייעשה בו שימוש.
- replace — המשתמש רוצה להחליף מדד קיים באחר. targetId = ה-id להסרה, ו-metric הוא החדש.

כללים למדד חדש:
- id: slug באנגלית, אותיות קטנות ומקפים, ייחודי ולא קיים ברשימה.
- title: תווית עברית קצרה, עד ארבע מילים.
- viz לפי סוג הנתון:
  · number — ערך בודד בלי מגמה
  · line — מגמה לאורך זמן (5–8 נקודות)
  · bar — השוואה בין פריטים (3–6)
  · donut — התפלגות ל-2 עד 4 חלקים
  · progress — התקדמות מול יעד (נקודה אחת, 0–100)
- value מעוצב ומוכן לתצוגה, כולל ₪ / % / M לפי העניין.
- insight: משפט עברי אחד, עובדתי, בלי סופרלטיבים ובלי אימוג'י.
- נתוני הדגמה חיוביים: מגמות עולות, פרויקטים בלוח הזמנים, תוצאות מעל התחזית.
  delta חיובי, ו-trend הוא "ok" או "neutral" — לא "warn" ולא "risk".
- אל תשכפל מדד שכבר קיים ברשימה. אם הבקשה דומה למדד קיים, בחר replace.
- reply: משפט אחד קצר בעברית בגוף ראשון, למשל ״הוספתי תזרים מזומנים חודשי ללוח.״

כל הטקסט בעברית. שמות מערכות באנגלית נשארים באנגלית.`;

export interface CommandResult {
  action: "add" | "remove" | "replace";
  metrics: Metric[];
  reply: string;
}

export async function applyCommand(
  text: string,
  current: Metric[],
  profile: Profile
): Promise<CommandResult> {
  const systems = connectors
    .filter((c) => c.status !== "unconfigured")
    .map((c) => c.name)
    .join(", ");

  const list = current.length
    ? current.map((m) => `- ${m.id} · ${m.title} (${m.viz}) — ${m.value}`).join("\n")
    : "(הלוח ריק)";

  const prompt = [
    `בעל הלוח: ${profile.name}, ${profile.title}`,
    `המערכות המחוברות: ${systems}`,
    "",
    "המדדים שכרגע על הלוח:",
    list,
    "",
    "הבקשה של המשתמש:",
    text,
  ].join("\n");

  const cmd = await structuredCall({
    system: SYSTEM,
    prompt,
    schema: CommandSchema,
    jsonSchema: toJsonSchema(CommandSchema),
    maxTokens: 6000,
  });

  if (cmd.action === "remove") {
    const next = current.filter((m) => m.id !== cmd.targetId);
    // A removal that matched nothing is a failed instruction, not a no-op —
    // say so rather than letting the phone report success.
    if (next.length === current.length) {
      return { action: "remove", metrics: current, reply: "לא מצאתי מדד כזה על הלוח." };
    }
    return { action: "remove", metrics: next, reply: cmd.reply };
  }

  const metric = normalise(cmd.metric, current);

  if (cmd.action === "replace") {
    const idx = current.findIndex((m) => m.id === cmd.targetId);
    if (idx === -1) return { action: "add", metrics: [...current, metric], reply: cmd.reply };
    const next = [...current];
    next[idx] = metric;
    return { action: "replace", metrics: next, reply: cmd.reply };
  }

  return { action: "add", metrics: [...current, metric], reply: cmd.reply };
}

/**
 * Reconcile the generated metric to something renderable, and guarantee its id
 * is unique — a duplicate id would collide with an existing card's React key.
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
