import {
  faArrowTrendDown,
  faArrowTrendUp,
  faChartPie,
  faChartSimple,
  faCircleCheck,
  faGaugeHigh,
  faHashtag,
  faMinus,
  faTriangleExclamation,
  faWaveSquare,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { Icon } from "@/components/Icon";
import { MetricViz } from "@/components/Charts";
import type { Metric, Trend } from "@/lib/ai/schemas";
import { cn } from "@/lib/cn";

const TREND: Record<Trend, { icon: IconDefinition; text: string; ring: string; label: string }> = {
  ok: { icon: faCircleCheck, text: "text-ok", ring: "bg-ok/12 text-ok", label: "תקין" },
  warn: { icon: faTriangleExclamation, text: "text-warn", ring: "bg-warn/12 text-warn", label: "תשומת לב" },
  risk: { icon: faTriangleExclamation, text: "text-risk", ring: "bg-risk/12 text-risk", label: "בסיכון" },
  neutral: { icon: faMinus, text: "text-ink-2", ring: "bg-brand/12 text-brand-hi", label: "יציב" },
};

const VIZ_ICON: Record<Metric["viz"], IconDefinition> = {
  number: faHashtag,
  line: faWaveSquare,
  bar: faChartSimple,
  donut: faChartPie,
  progress: faGaugeHigh,
};

/**
 * `full` shows chart and written insight; `compact` drops the prose and shrinks
 * the value, for layouts that put comparability ahead of depth. The compact
 * form keeps the chart — a number without its shape is not a metric.
 */
export function MetricCard({
  metric,
  index,
  variant = "full",
  className,
}: {
  metric: Metric;
  index: number;
  variant?: "full" | "compact";
  /** Grid placement from the parent layout — span, self-alignment. */
  className?: string;
}) {
  const t = TREND[metric.trend] ?? TREND.neutral;
  const up = metric.delta >= 0;
  const showViz = metric.viz !== "number" && (metric.series?.length ?? 0) > 0;
  const compact = variant === "compact";

  return (
    <article
      // No h-full: a grid item already stretches to its row by default, and an
      // explicit 100% would resolve against the row height even under
      // items-start — which is exactly what the hero layout needs to avoid.
      className={cn("notif rise", compact ? "p-3.5" : "p-4", className)}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {/* Notification header — app tile, source, state */}
      <header className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-[8px] text-[13px]",
            t.ring
          )}
        >
          <Icon icon={VIZ_ICON[metric.viz] ?? faHashtag} />
        </span>

        <h2 className={cn("truncate font-medium text-ink-2", compact ? "text-[12.5px]" : "text-[14px]")}>
          {metric.title}
        </h2>

        <span
          className={cn(
            "ms-auto flex shrink-0 items-center gap-1 text-[12px] font-medium",
            t.text
          )}
        >
          <Icon icon={t.icon} className="text-[11px]" />
          {/* In a two-up tile the label competes with the title for width;
              the icon already carries the state. */}
          {!compact && t.label}
        </span>
      </header>

      {/* Headline value */}
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p
          className={cn(
            "num leading-none font-light tracking-tight text-ink",
            // Three tiles share the row, so the headline is sized to fit the
            // narrowest of them rather than to fill a full-width card.
            compact ? "text-[24px]" : "text-[28px] sm:text-[30px]"
          )}
        >
          {metric.value}
        </p>

        {metric.delta !== 0 && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
              up ? "bg-ok/10 text-ok" : "bg-risk/10 text-risk"
            )}
          >
            <Icon icon={up ? faArrowTrendUp : faArrowTrendDown} className="text-[10px]" />
            <span className="num">
              {up ? "+" : ""}
              {metric.delta}%
            </span>
          </span>
        )}
      </div>

      {!compact && (metric.caption || metric.deltaLabel) && (
        <p className="mt-1 text-[12px] text-ink-3">
          <span className="bidi">{metric.caption}</span>
          {metric.caption && metric.deltaLabel && <span className="mx-1.5 text-line-strong">·</span>}
          <span className="bidi">{metric.deltaLabel}</span>
        </p>
      )}

      {showViz && (
        <div className={compact ? "mt-2.5" : "mt-3"}>
          <MetricViz metric={metric} compact={compact} />
        </div>
      )}

      {!compact && metric.insight && (
        <p className="mt-3 border-t border-line pt-2.5 text-[13px] leading-relaxed text-ink-2">
          {metric.insight}
        </p>
      )}
    </article>
  );
}
