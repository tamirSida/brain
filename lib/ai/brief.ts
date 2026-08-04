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

const PLAN_SYSTEM = `You are the Organization Brain for Lightstone, a US real estate
investment, development and management firm.
The user has described in free text which metrics matter to them.
Turn that into three specs, ordered by importance to their role.

Each spec is a single line saying:
- what the metric is
- which visual suits it (single value / trend over time / comparison across
  items / distribution / progress against a target)
- what plausible demo data it should carry, including order of magnitude

Example: "Monthly cash flow — a trend across six months, around $6M and rising".

Exactly three specs, none duplicating another. Write in English.`;

export async function buildBrief(profile: Profile): Promise<Brief> {
  const systems = connectors
    .filter((c) => c.status !== "unconfigured")
    .map((c) => c.name)
    .join(", ");

  const plan = await structuredCall({
    system: PLAN_SYSTEM,
    prompt: [
      `Name: ${profile.name}`,
      `Role: ${profile.title}`,
      `Connected systems: ${systems}`,
      "",
      "What they said matters:",
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
    throw new Error(`The model returned ${specs.length} metrics instead of three.`);
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
