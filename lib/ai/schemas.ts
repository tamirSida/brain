import { z } from "zod";

/** How a metric should be visualised. The model picks this per metric. */
export const VizSchema = z.enum(["number", "line", "bar", "donut", "progress"]);
export type Viz = z.infer<typeof VizSchema>;

export const TrendSchema = z.enum(["ok", "warn", "risk", "neutral"]);
export type Trend = z.infer<typeof TrendSchema>;

export const MetricSchema = z.object({
  /** Stable slug, latin, kebab-case. */
  id: z.string(),
  /** Short Hebrew label — max ~4 words. */
  title: z.string(),
  /** Which infographic fits this metric. */
  viz: VizSchema,
  /** Formatted headline value, e.g. "94.2%" or "₪12.4M". */
  value: z.string(),
  /** Optional Hebrew unit/subtitle, e.g. "12 פרויקטים". */
  caption: z.string(),
  /** Percent change vs the comparison period. Negative is a decline. */
  delta: z.number(),
  /** Hebrew label for the comparison, e.g. "מול הרבעון הקודם". */
  deltaLabel: z.string(),
  /** Whether this reads as healthy, watch, or at-risk. */
  trend: TrendSchema,
  /** One Hebrew sentence — what this number means right now. */
  insight: z.string(),
  /**
   * Data behind the visual. 4–8 points for line/bar, 2–4 slices for donut,
   * a single point for progress, empty for number.
   */
  series: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
    })
  ),
});
export type Metric = z.infer<typeof MetricSchema>;

export const BriefSchema = z.object({
  /**
   * The board. Starts as three at onboarding and grows or shrinks from the
   * phone remote, so nothing here pins the length.
   */
  metrics: z.array(MetricSchema),
});
export type Brief = z.infer<typeof BriefSchema>;
