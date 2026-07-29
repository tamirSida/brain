import type { Metric, Trend } from "@/lib/ai/schemas";

/* Charts are decorative reinforcement — every value is also present as text on
   the card, so a screen reader never depends on the SVG. Marked aria-hidden. */

const TREND_VAR: Record<Trend, string> = {
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  risk: "var(--color-risk)",
  neutral: "var(--color-brand-hi)",
};

type Point = { label: string; value: number };

/** Catmull-Rom → cubic bezier, for a smooth line without a charting library. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/* --------------------------------------------------------------- line ---- */
/* Time flows left→right even in RTL — the Israeli enterprise convention.
   Applied consistently across every time-series chart in the product. */

function LineChart({ series, color }: { series: Point[]; color: string }) {
  const W = 260;
  const H = 68;
  const P = 6;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const pts = series.map((s, i) => ({
    x: P + (i * (W - P * 2)) / Math.max(series.length - 1, 1),
    y: H - P - ((s.value - min) / span) * (H - P * 2),
  }));

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const last = pts[pts.length - 1];
  const gid = `g-${series.length}-${Math.round(max)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[68px]" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="3.2" fill={color} />
      <circle cx={last.x} cy={last.y} r="6.5" fill={color} opacity="0.18" />
    </svg>
  );
}

/* ---------------------------------------------------------------- bars ---- */
/* Horizontal bars anchored to the right — the natural reading direction for
   labelled categorical comparison in Hebrew. */

function BarChart({ series, color }: { series: Point[]; color: string }) {
  const max = Math.max(...series.map((s) => Math.abs(s.value))) || 1;
  return (
    <ul className="space-y-2.5">
      {series.slice(0, 6).map((s, i) => (
        <li key={`${s.label}-${i}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] text-ink-2">{s.label}</span>
              <span className="num text-[13px] font-medium text-ink">
                {s.value > 0 ? "+" : ""}
                {s.value}
              </span>
            </div>
            {/* Bars grow from the inline-start edge — the right, in RTL.
                No auto margin: that would push the fill to the wrong end.

                Negatives get a distinct hue, not just lower opacity: in a
                variance chart, "under" is a different fact from "over", and an
                opacity difference alone reads as the same warning to everyone. */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max((Math.abs(s.value) / max) * 100, 3)}%`,
                  background: s.value < 0 ? "var(--color-ink-2)" : color,
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- donut ---- */

function DonutChart({ series, color }: { series: Point[]; color: string }) {
  const total = series.reduce((a, s) => a + Math.abs(s.value), 0) || 1;
  const R = 34;
  const C = 2 * Math.PI * R;
  const shades = [1, 0.62, 0.38, 0.22];

  // Offsets are precomputed rather than accumulated during the render pass —
  // mutating a closure variable inside map() breaks under React Compiler.
  const slices = series.slice(0, 4).reduce<
    { label: string; frac: number; offset: number }[]
  >((acc, s) => {
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.frac * C : 0;
    return [...acc, { label: s.label, frac: Math.abs(s.value) / total, offset }];
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] shrink-0 -rotate-90" aria-hidden>
        <circle cx="44" cy="44" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
        {slices.map((s, i) => (
          <circle
            key={`${s.label}-${i}`}
            cx="44"
            cy="44"
            r={R}
            fill="none"
            stroke={color}
            strokeOpacity={shades[i] ?? 0.2}
            strokeWidth="10"
            strokeDasharray={`${s.frac * C} ${C}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {series.slice(0, 4).map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2 shrink-0 rounded-[3px]"
              style={{ background: color, opacity: shades[i] ?? 0.2 }}
            />
            <span className="truncate text-ink-2">{s.label}</span>
            <span className="num ms-auto font-medium text-ink">
              {Math.round((Math.abs(s.value) / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ progress ---- */

function ProgressChart({ series, color }: { series: Point[]; color: string }) {
  // Already normalised to 0-100 in lib/ai/brief.ts — clamp only, never re-scale.
  const pct = Math.max(0, Math.min(100, series[0]?.value ?? 0));
  return (
    <div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-line">
        {/* start-0, not end-0: the fill must grow from the right in RTL. */}
        <div
          className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px] text-ink-3">
        <span>{series[0]?.label ?? "יעד"}</span>
        <span className="num">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function MetricViz({ metric }: { metric: Metric }) {
  const color = TREND_VAR[metric.trend];
  const s = metric.series ?? [];

  if (metric.viz === "number" || s.length === 0) return null;
  if (metric.viz === "line" && s.length >= 2) return <LineChart series={s} color={color} />;
  if (metric.viz === "bar") return <BarChart series={s} color={color} />;
  if (metric.viz === "donut") return <DonutChart series={s} color={color} />;
  if (metric.viz === "progress") return <ProgressChart series={s} color={color} />;
  return <BarChart series={s} color={color} />;
}
