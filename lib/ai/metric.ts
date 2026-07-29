import "server-only";

import { structuredCall, toJsonSchema } from "./client";
import { MetricSchema, type Metric } from "./schemas";

/**
 * Building one metric card.
 *
 * Shared by onboarding and the phone remote so a card added by voice is the
 * same shape as one created at signup — and so the rules that keep charts
 * renderable live in exactly one place.
 */

export const METRIC_RULES = `אתה בונה מדד יחיד ללוח מדדים של חברת נדל״ן ואחזקות ישראלית.

- id: slug באנגלית, אותיות קטנות ומקפים, שלא קיים ברשימת ה-id התפוסים.
- title: תווית עברית קצרה, עד ארבע מילים.
- viz לפי סוג הנתון:
  · number — ערך בודד בלי מגמה
  · line — מגמה לאורך זמן (5–8 נקודות)
  · bar — השוואה בין פריטים (3–6)
  · donut — התפלגות ל-2 עד 4 חלקים
  · progress — התקדמות מול יעד (נקודה אחת, 0–100)
- value מעוצב ומוכן לתצוגה, כולל ₪ / % / M לפי העניין.
- אם המפרט כולל מספרים — השתמש בהם בדיוק, אל תמציא אחרים.
- insight: משפט עברי אחד, עובדתי, בלי סופרלטיבים ובלי אימוג'י.
- נתוני הדגמה חיוביים: delta חיובי, trend הוא "ok" או "neutral".

כל הטקסט בעברית. שמות מערכות באנגלית נשארים באנגלית.`;

/** Generate a single metric from a one-line spec. */
export async function buildMetric(spec: string, takenIds: string[]): Promise<Metric> {
  const built = await structuredCall({
    system: METRIC_RULES,
    prompt: [
      `id-ים תפוסים: ${takenIds.join(", ") || "(אין)"}`,
      "",
      "המדד לבנייה:",
      spec,
    ].join("\n"),
    schema: MetricSchema,
    jsonSchema: toJsonSchema(MetricSchema),
    maxTokens: 3000,
  });
  return built;
}

/**
 * Reconcile a generated metric to something renderable.
 *
 * The schema guarantees types, not coherence: the model can return a `line`
 * with one point or a `donut` with seven slices. Rather than render something
 * visibly wrong, fit the visual to the data it actually has — and guarantee
 * the id is unique, since a duplicate collides with an existing card's key.
 */
export function normaliseMetric(m: Metric, taken: Iterable<string>): Metric {
  const series = (m.series ?? []).filter((p) => Number.isFinite(p.value));

  let viz = m.viz;
  if (series.length === 0) viz = "number";
  else if (viz === "line" && series.length < 3) viz = "bar";

  let points = series;
  if (viz === "donut" && series.length > 4) {
    // Keep the largest three, fold the rest into one "other" slice.
    const sorted = [...series].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const rest = sorted.slice(3).reduce((sum, p) => sum + Math.abs(p.value), 0);
    points = [...sorted.slice(0, 3), { label: "אחר", value: rest }];
  }
  if (viz === "bar" && series.length > 6) points = series.slice(0, 6);
  if (viz === "progress" && series.length) {
    // Accept either a 0–1 fraction or a 0–100 percentage, but never guess on
    // exactly 1 — treat a lone 1 as 1%, matching how the model writes percents.
    const raw = series[0].value;
    const pct = raw > 0 && raw < 1 ? raw * 100 : raw;
    points = [{ ...series[0], value: Math.max(0, Math.min(100, pct)) }];
  }
  if (viz === "number") points = [];

  const used = new Set(taken);
  let id = m.id?.trim() || "metric";
  while (used.has(id)) id = `${id}-2`;

  return { ...m, id, viz, series: points };
}
