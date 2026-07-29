/**
 * Dashboard layouts.
 *
 * Three, not more — each maps to a distinct, well-established way of reading a
 * BI screen, and offering variations of the same idea just makes the choice
 * harder without changing what the user can see:
 *
 *  stack — equal width, every metric with its chart and its written insight.
 *          The highest information density per metric.
 *  hero  — inverted pyramid: the lead metric keeps its full detail, the other
 *          two are context. The "five-second rule" layout — one number answers
 *          the main question before the eye moves on.
 *  grid  — a scorecard: all three compact and directly comparable. Reading is
 *          scan-first; depth is deliberately traded for comparability.
 *
 * All three collapse to a single column on a phone and open to a single row
 * from `lg` up — they differ in emphasis and depth, not in wrapping.
 */

export const LAYOUTS = ["stack", "hero", "grid"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

// Compact by default: three equal, directly comparable tiles is the safest
// first impression, and the layout can be changed from the dashboard.
export const DEFAULT_LAYOUT: LayoutId = "grid";

export interface LayoutOption {
  id: LayoutId;
  name: string;
  /** What it's good for — phrased as a reading strategy, not a shape. */
  blurb: string;
  /** Schematic for the picker: one box per metric as laid out on a wide
   *  screen, `w` its share of the row and `full` whether it carries the
   *  written insight as well as the chart. */
  sketch: { w: number; full: boolean }[];
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "stack",
    name: "מפורט",
    blurb: "שלושת המדדים ברוחב שווה, כל אחד עם גרף והסבר כתוב. הכי מפורט.",
    sketch: [
      { w: 1, full: true },
      { w: 1, full: true },
      { w: 1, full: true },
    ],
  },
  {
    id: "hero",
    name: "מדד מוביל",
    blurb: "המדד החשוב עם הסבר מלא, ושניים לצידו כהקשר. תשובה במבט אחד.",
    sketch: [
      { w: 1, full: true },
      { w: 1, full: false },
      { w: 1, full: false },
    ],
  },
  {
    id: "grid",
    name: "קומפקטי",
    blurb: "שלושת המדדים קומפקטיים והשוואתיים, בלי טקסט מלווה.",
    sketch: [
      { w: 1, full: false },
      { w: 1, full: false },
      { w: 1, full: false },
    ],
  },
];

export function isLayout(v: unknown): v is LayoutId {
  return typeof v === "string" && (LAYOUTS as readonly string[]).includes(v);
}
