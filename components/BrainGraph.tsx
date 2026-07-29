import Image from "next/image";
import type { Connector, ConnectorStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const STATE: Record<ConnectorStatus, { stroke: string; dot: string; flow: boolean }> = {
  live: { stroke: "var(--ok)", dot: "bg-ok", flow: false },
  syncing: { stroke: "var(--warn)", dot: "bg-warn", flow: true },
  error: { stroke: "var(--risk)", dot: "bg-risk", flow: false },
  unconfigured: { stroke: "var(--line-strong)", dot: "bg-ink-faint", flow: false },
};

const SIZE = 360;
const C = SIZE / 2;
const R = 132;

function layout(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const rad = ((-90 + (i * 360) / count) * Math.PI) / 180;
    return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
  });
}

/**
 * Connector state as a radial graph.
 *
 * MOCK: state and counts come from config/connectors.json — fixture data, not
 * live telemetry. The shape is what a production version would render.
 *
 * Logos sit on a chip so they read on both themes. The supplied brand assets are
 * a mix of wordmarks and square marks at aspect ratios from 1:1 to 5.6:1, some
 * with no alpha and one (DocuSign) white-on-dark — hence the per-connector
 * `chip` hint in config/connectors.json.
 */
export function BrainGraph({ connectors }: { connectors: Connector[] }) {
  const pts = layout(connectors.length);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle
          cx={C}
          cy={C}
          r={R * 0.54}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          opacity="0.55"
        />

        {connectors.map((conn, i) => {
          const s = STATE[conn.status] ?? STATE.live;
          const p = pts[i];
          return (
            <line
              key={conn.id}
              x1={C}
              y1={C}
              x2={p.x}
              y2={p.y}
              stroke={s.stroke}
              strokeWidth="1.5"
              strokeOpacity="0.5"
              className={s.flow ? "edge-flow" : undefined}
            />
          );
        })}

        <circle cx={C} cy={C} r="50" fill="var(--bg-2)" />
        <circle cx={C} cy={C} r="50" fill="none" stroke="var(--brand)" strokeOpacity="0.35" strokeWidth="1" />
        <circle
          cx={C}
          cy={C}
          r="63"
          fill="none"
          stroke="var(--brand)"
          strokeOpacity="0.16"
          strokeWidth="1"
          className="pulse"
        />
      </svg>

      {/* Core — the Ofek mark is white-on-dark by design, so it gets a chip in
          light mode to stay legible. */}
      <div className="absolute left-1/2 top-1/2 grid size-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#0d131b]">
        <Image src="/ofek-logo.svg" alt="אופק" width={62} height={22} priority />
      </div>

      {/* Nodes */}
      {connectors.map((conn, i) => {
        const s = STATE[conn.status] ?? STATE.live;
        const p = pts[i];
        return (
          <div
            key={conn.id}
            title={`${conn.name} — ${conn.kind}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%` }}
          >
            <div
              className={cn(
                "relative grid h-10 w-[74px] place-items-center rounded-[10px] border border-line px-2 shadow-sm",
                conn.chip === "dark" ? "bg-[#0d131b]" : "bg-white"
              )}
            >
              {/* fill + object-contain: the supplied assets range from 1:1 to
                  5.6:1, and only a fixed box with contain fits them all. */}
              <span className="relative block h-[22px] w-full">
                <Image
                  src={conn.logo}
                  alt={conn.name}
                  fill
                  sizes="74px"
                  className="object-contain"
                />
              </span>
              <span
                className={cn(
                  "absolute -end-1 -top-1 size-2.5 rounded-full ring-2 ring-bg",
                  s.dot
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
