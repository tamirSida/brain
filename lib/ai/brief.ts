import "server-only";

import { structuredCall, toJsonSchema } from "./client";
import { BriefSchema, type Brief, type Metric } from "./schemas";
import type { Profile } from "@/lib/types";
import { connectors } from "@/lib/connectors";

const SYSTEM = `אתה המוח הארגוני של ״אופק אחזקות״ — חברת נדל״ן ואחזקות ישראלית.
המשתמש תיאר בטקסט חופשי אילו מדדים מעניינים אותו. תפקידך לתרגם את זה לשלושה מדדים מוגדרים היטב שיוצגו על מסך הבית.

כללים:
- בחר בדיוק שלושה מדדים, לפי סדר החשיבות עבור התפקיד.
- לכל מדד בחר את סוג ההמחשה המתאים לסוג הנתון:
  · number — ערך בודד שאין לו מגמה משמעותית (למשל: מספר פרויקטים פעילים)
  · line — מגמה לאורך זמן (למשל: תזרים חודשי)
  · bar — השוואה בין פריטים (למשל: חריגה תקציבית לפי פרויקט)
  · donut — התפלגות של שלם ל-2 עד 4 חלקים (למשל: תמהיל תיק הנכסים)
  · progress — התקדמות מול יעד באחוזים (למשל: אחוז אכלוס)
- אל תבחר "line" למדד שאין לו ציר זמן, ואל תבחר "donut" ליותר מארבעה חלקים.
- ה-series חייב להתאים ל-viz: 5–8 נקודות ל-line, 3–6 ל-bar, 2–4 ל-donut, נקודה אחת ל-progress, ומערך ריק ל-number.
- מספרים ב-value יהיו מעוצבים ומוכנים לתצוגה, כולל ₪ / % / K / M / B לפי העניין.
- insight הוא משפט עברי אחד, עובדתי. בלי סופרלטיבים, בלי אימוג'י, בלי "חשוב לציין".
- כל נתוני ההדגמה חיוביים: מגמות עולות, פרויקטים בלוח הזמנים או מקדימים אותו, תוצאות מעל התחזית.
  אין משבר, אין חריגה ואין עיכוב. delta חיובי, ו-trend הוא "ok" או "neutral" — לא "warn".
  זו הדגמה למכירה, לא דוח סיכונים.
- briefing הוא 1–2 משפטים שקושרים בין שלושת המדדים. פתח בעובדה קונקרטית עם מספר או שם פרויקט.
  אסורים משפטי הקדמה שלא אומרים כלום: ״הנה תמונת המצב״, ״להלן סקירה״, ״ריכזנו עבורך״.
- נתוני הדגמה סבירים לחברת נדל״ן ישראלית. שמות פרויקטים בעברית.
- כל הטקסט בעברית. שמות מערכות באנגלית נשארים באנגלית.`;

export async function buildBrief(profile: Profile): Promise<Brief> {
  const systems = connectors
    .filter((c) => c.status !== "unconfigured")
    .map((c) => c.name)
    .join(", ");

  const prompt = [
    `שם: ${profile.name}`,
    `תפקיד: ${profile.title}`,
    `המערכות המחוברות: ${systems}`,
    "",
    "מה שנכתב כחשוב:",
    profile.focus,
  ].join("\n");

  const brief = await structuredCall({
    system: SYSTEM,
    prompt,
    schema: BriefSchema,
    jsonSchema: toJsonSchema(BriefSchema),
    maxTokens: 8192,
  });

  // The schema can't enforce a length (structured outputs rejects minItems > 1),
  // so pin it here. The prompt asks for exactly three.
  if (brief.metrics.length < 3) {
    throw new Error(`המודל החזיר ${brief.metrics.length} מדדים במקום שלושה.`);
  }
  return { ...brief, metrics: brief.metrics.slice(0, 3).map(normalizeMetric) };
}

/**
 * The schema guarantees types, not coherence: the model can return a `line`
 * with one point, or a `donut` with seven slices. Rather than render something
 * visibly wrong, reconcile viz to the data it actually has.
 */
function normalizeMetric(m: Metric): Metric {
  const series = (m.series ?? []).filter((p) => Number.isFinite(p.value));

  if (series.length === 0) return { ...m, viz: "number", series: [] };

  if (m.viz === "line" && series.length < 3) {
    return { ...m, viz: "bar", series };
  }

  if (m.viz === "donut" && series.length > 4) {
    // Keep the largest three, fold the rest into one "other" slice.
    const sorted = [...series].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const rest = sorted.slice(3).reduce((sum, p) => sum + Math.abs(p.value), 0);
    return { ...m, series: [...sorted.slice(0, 3), { label: "אחר", value: rest }] };
  }

  if (m.viz === "progress") {
    // Accept either a 0–1 fraction or a 0–100 percentage, but never guess on
    // exactly 1 — treat a lone 1 as 1%, matching how the model writes percents.
    const raw = series[0].value;
    const pct = raw > 0 && raw < 1 ? raw * 100 : raw;
    return { ...m, series: [{ ...series[0], value: Math.max(0, Math.min(100, pct)) }] };
  }

  if (m.viz === "bar" && series.length > 6) {
    return { ...m, series: series.slice(0, 6) };
  }

  return { ...m, series };
}
