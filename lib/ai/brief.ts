import "server-only";

import { z } from "zod";

import { structuredCall, toJsonSchema } from "./client";
import { buildMetric, normaliseMetric } from "./metric";
import { type Brief } from "./schemas";
import type { Profile } from "@/lib/types";
import { connectors } from "@/lib/connectors";

/**
 * The opening dashboard, built from the user's free-text answer.
 *
 * Plan first, then build the three cards concurrently. Asking one structured
 * response for all three measured at 24 seconds, because the model wrote them
 * serially; planning and then fanning out is the same work with the three
 * slowest parts overlapped.
 */

const PlanSchema = z.object({
  /**
   * Three specs, ordered by importance to the role. Each is one line naming
   * the metric and the shape of its data, concrete enough to build from alone.
   */
  specs: z.array(z.string()),
});

const PLAN_SYSTEM = `אתה המוח הארגוני של ״אופק אחזקות״ — חברת נדל״ן ואחזקות ישראלית.
המשתמש תיאר בטקסט חופשי אילו מדדים מעניינים אותו.
תרגם את זה לשלושה מפרטים, לפי סדר החשיבות עבור התפקיד.

כל מפרט הוא שורה אחת בעברית שאומרת:
- מה המדד
- איזו תצוגה מתאימה לו (ערך בודד / מגמה לאורך זמן / השוואה בין פריטים /
  התפלגות / התקדמות מול יעד)
- אילו נתוני הדגמה סבירים הוא צריך לשאת, כולל סדר גודל

דוגמה: ״תזרים מזומנים חודשי — מגמה לאורך שישה חודשים, בסביבות ₪6M ובעלייה״.

בדיוק שלושה מפרטים, בלי כפילויות ביניהם. הכל בעברית.`;

export async function buildBrief(profile: Profile): Promise<Brief> {
  const systems = connectors
    .filter((c) => c.status !== "unconfigured")
    .map((c) => c.name)
    .join(", ");

  const plan = await structuredCall({
    system: PLAN_SYSTEM,
    prompt: [
      `שם: ${profile.name}`,
      `תפקיד: ${profile.title}`,
      `המערכות המחוברות: ${systems}`,
      "",
      "מה שנכתב כחשוב:",
      profile.focus,
    ].join("\n"),
    schema: PlanSchema,
    jsonSchema: toJsonSchema(PlanSchema),
    maxTokens: 2000,
  });

  // The schema can't enforce a length — structured outputs reject minItems > 1 —
  // so pin it here. The prompt asks for exactly three.
  const specs = plan.specs.filter((s) => s.trim().length > 0).slice(0, 3);
  if (specs.length < 3) {
    throw new Error(`המודל החזיר ${specs.length} מדדים במקום שלושה.`);
  }

  const built = await Promise.all(specs.map((spec) => buildMetric(spec, [])));

  // Ids are deduped in order: the cards were generated independently and know
  // nothing about each other, so two can easily land on the same slug.
  const taken = new Set<string>();
  const metrics = built.map((m) => {
    const fixed = normaliseMetric(m, taken);
    taken.add(fixed.id);
    return fixed;
  });

  return { metrics };
}
