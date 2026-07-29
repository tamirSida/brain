import { MetricCard } from "@/components/MetricCard";
import type { Metric } from "@/lib/ai/schemas";
import type { LayoutId } from "@/lib/layouts";

/**
 * Arranges the three metrics according to the chosen layout.
 *
 * Two rules hold across all three:
 *
 *  - Below `sm` everything is a single column. Two 26px values side by side on
 *    a 375px screen is unreadable.
 *  - From `lg` up everything is a single row. On a desktop or a wall display
 *    the whole point is that all three are visible at once without scrolling,
 *    so the layouts differ there by *emphasis and depth*, not by wrapping.
 */
export function MetricLayout({ metrics, layout }: { metrics: Metric[]; layout: LayoutId }) {
  const [lead, ...rest] = metrics;

  if (layout === "hero") {
    return (
      // Equal boxes; the lead is distinguished by *depth* — it keeps its
      // caption and written insight — not by taking more of the row. Equal
      // tiles read as one instrument panel rather than a feature and two
      // afterthoughts.
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lead && <MetricCard metric={lead} index={0} className="sm:col-span-2 lg:col-span-1" />}
        {rest.map((m, i) => (
          <MetricCard key={m.id ?? i} metric={m} index={i + 1} variant="compact" />
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, i) => (
          // The card is the grid item itself — wrapping it in a div would let
          // the wrapper stretch to the row while the card kept its own height,
          // leaving the tiles visibly unequal.
          //
          // Three tiles in a two-column grid leave a hole, so the last one
          // spans it. At `lg` there are three columns and nothing to fill.
          <MetricCard
            key={m.id ?? i}
            metric={m}
            index={i}
            variant="compact"
            className={
              i === metrics.length - 1 && i % 2 === 0 ? "sm:col-span-2 lg:col-span-1" : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {metrics.map((m, i) => (
        <MetricCard key={m.id ?? i} metric={m} index={i} />
      ))}
    </div>
  );
}
