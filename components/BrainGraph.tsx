"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { Connector, ConnectorStatus } from "@/lib/types";
import { BrandMark } from "@/components/Brand";
import { cn } from "@/lib/cn";
import { useThinking } from "@/lib/thinking";

/**
 * Connector state as a brain.
 *
 * The "brain" reading is structural, not decorative: every system is a nerve
 * ending, each pathway curves inward like a gyrus rather than running straight,
 * and signals travel *toward* the core — the systems feed the brain, not the
 * other way round. Nothing here is a neural-network backdrop; each mark is a
 * real connector and each pulse means that connector is flowing.
 *
 * MOCK: state and counts come from config/connectors.json — fixture data, not
 * live telemetry. The shape is what a production version would render.
 *
 * Logos sit on a chip so they read on both themes. The supplied brand assets are
 * a mix of wordmarks and square marks at aspect ratios from 1:1 to 5.6:1, some
 * with no alpha — hence the per-connector `chip` hint in connectors.json.
 */

const STATE: Record<ConnectorStatus, { stroke: string; dot: string; label: string }> = {
  live: { stroke: "var(--ok)", dot: "bg-ok", label: "Live" },
  syncing: { stroke: "var(--warn)", dot: "bg-warn", label: "Syncing" },
  error: { stroke: "var(--risk)", dot: "bg-risk", label: "Error" },
  unconfigured: { stroke: "var(--line-strong)", dot: "bg-ink-faint", label: "Not connected" },
};

const SIZE = 360;
const C = SIZE / 2;
const R = 130;
/** Where a pathway leaves the core, and where it meets a node's chip. */
const CORE_R = 54;
const NODE_GAP = 26;
/** Sideways lean of every pathway. All the same sign, so the whole thing
 *  reads as one organ with a grain rather than a bicycle wheel. */
const SWIRL = 0.3;

interface Node {
  conn: Connector;
  x: number;
  y: number;
  /** Curved pathway, node → core: signals travel inward along it. */
  path: string;
}

function polar(r: number, a: number) {
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function build(connectors: Connector[]): Node[] {
  return connectors.map((conn, i) => {
    const a = ((-90 + (i * 360) / connectors.length) * Math.PI) / 180;
    // A little deterministic variation in reach — a perfect circle reads as a
    // dial, and cortex isn't one. Small enough that chips never collide.
    const r = R + [0, -7, 5, -4, 8, -6, 3][i % 7];

    const node = polar(r, a);
    const start = polar(r - NODE_GAP, a);
    const end = polar(CORE_R, a);
    const ctrl = polar((r - NODE_GAP + CORE_R) / 2, a + SWIRL);

    return {
      conn,
      x: node.x,
      y: node.y,
      path: `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`,
    };
  });
}

export function BrainGraph({ connectors }: { connectors: Connector[] }) {
  const nodes = useMemo(() => build(connectors), [connectors]);
  const [active, setActive] = useState<string | null>(null);
  const [motion, setMotion] = useState(false);
  const thinking = useThinking();

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    // SMIL can't be switched off from CSS, so gate the pulses in JS instead.
    const apply = () => setMotion(!q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);

  const shown = nodes.find((n) => n.conn.id === active)?.conn ?? null;

  return (
    <div>
      <div
        // Capped tighter on desktop: the graph and the agenda share one
        // column, and the agenda is the part that needs the room.
        className="relative mx-auto aspect-square w-full max-w-[360px] lg:max-w-[320px]"
        onMouseLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            {nodes.map((n) => (
              <path key={n.conn.id} id={`p-${n.conn.id}`} d={n.path} />
            ))}
          </defs>

          {/* Cortex contours — faint, unclosed, slightly off-centre so they
              suggest an organ rather than a target. */}
          <circle cx={C} cy={C} r={R + 14} fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.4" />
          <circle
            cx={C}
            cy={C - 4}
            r={R - 20}
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            opacity="0.5"
            strokeDasharray="2 7"
          />
          <circle cx={C} cy={C + 3} r={CORE_R + 22} fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.45" />

          {nodes.map((n, i) => {
            const s = STATE[n.conn.status] ?? STATE.live;
            const on = active === n.conn.id;
            const dim = active !== null && !on;
            const flowing = n.conn.status === "live" || n.conn.status === "syncing";

            return (
              <g key={n.conn.id} style={{ transition: "opacity 220ms" }} opacity={dim ? 0.25 : 1}>
                <use
                  href={`#p-${n.conn.id}`}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth={on ? 2.4 : thinking ? 2 : 1.4}
                  strokeOpacity={on ? 0.95 : thinking ? 0.8 : 0.45}
                  strokeLinecap="round"
                  style={{ transition: "stroke-width 220ms, stroke-opacity 220ms" }}
                />

                {/* One signal per pathway, travelling node → core. Staggered so
                    they never march in lockstep. */}
                {/* Signals speed up and double while the brain is working.
                    Keyed on `thinking` so SMIL restarts cleanly — mutating
                    `dur` in place leaves the running animation on the old
                    timing. */}
                {motion &&
                  flowing &&
                  (thinking ? [0, 0.5] : [0]).map((offset) => (
                    <circle
                      key={`${thinking}-${offset}`}
                      r={on ? 3.2 : thinking ? 2.8 : 2.2}
                      fill={s.stroke}
                      opacity={on ? 1 : 0.75}
                    >
                      <animateMotion
                        dur={
                          thinking ? "1.1s" : n.conn.status === "syncing" ? "1.9s" : "3.4s"
                        }
                        begin={`${i * (thinking ? 0.12 : 0.42) + offset}s`}
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.4 0 0.6 1"
                      >
                        <mpath href={`#p-${n.conn.id}`} />
                      </animateMotion>
                    </circle>
                  ))}
              </g>
            );
          })}

          {/* Core. The white disc is drawn here rather than as an HTML layer so
              it scales with the graph — a fixed-pixel div left a gap between the
              disc and the mark that grew and shrank with the viewport.

              No trim: at rest this is a plain white disc with the mark on it.
              The ring belongs to the mark and only appears while thinking, so a
              ring around the core always means the core is working. */}
          <circle cx={C} cy={C} r={CORE_R} fill="#ffffff" />
          <circle
            cx={C}
            cy={C}
            r={CORE_R + 13}
            fill="none"
            stroke="var(--brand)"
            strokeOpacity={thinking ? 0.5 : 0.16}
            strokeWidth={thinking ? 1.6 : 1}
            className={thinking ? "pulse-fast" : "pulse"}
          />
          {/* A second ring only while working, offset so the two read as a
              ripple leaving the core rather than one thicker ring. */}
          {thinking && (
            <circle
              cx={C}
              cy={C}
              r={CORE_R + 26}
              fill="none"
              stroke="var(--brand)"
              strokeOpacity="0.28"
              strokeWidth="1"
              className="pulse-fast"
              style={{ animationDelay: "450ms" }}
            />
          )}
        </svg>

        {/* The mark sits over the white core drawn above — so the centre of the
            graph is the identity rather than a dark disc with a logo on it, and
            the red reads as the brand rather than as one more status colour
            among the node rings. While the brain works, the orbit picks up the
            same red. The thing at the centre of the graph is the thing that is
            thinking. */}
        {/* Sized as a percentage, not in pixels, so it tracks the core disc at
            every breakpoint: the disc is 2·CORE_R of a SIZE-wide viewBox, which
            is 30% of the container. That alignment is the point — the mark's
            orbit arc sits just inside the disc edge, so while the brain works
            the ring reads as the rim of the core rather than as a spinner that
            happens to be nearby. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2">
          <BrandMark className="size-full text-[#D01E3B]" />
        </div>

        {/* Nodes */}
        {nodes.map((n) => {
          const s = STATE[n.conn.status] ?? STATE.live;
          const on = active === n.conn.id;
          const dim = active !== null && !on;

          return (
            <button
              key={n.conn.id}
              type="button"
              // Hover on a pointer, tap on touch — both land on the same state.
              onMouseEnter={() => setActive(n.conn.id)}
              onFocus={() => setActive(n.conn.id)}
              onClick={() => setActive(on ? null : n.conn.id)}
              aria-pressed={on}
              aria-label={`${n.conn.name} — ${s.label}`}
              className="absolute rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              style={{
                left: `${(n.x / SIZE) * 100}%`,
                top: `${(n.y / SIZE) * 100}%`,
                opacity: dim ? 0.4 : 1,
                transition: "opacity 220ms, transform 220ms",
                // Physical translate written out rather than a utility class:
                // `left` is physical here, so the centring offset must be too.
                transform: `translate(-50%, -50%) scale(${on ? 1.08 : 1})`,
              }}
            >
              <span
                className={cn(
                  "relative grid h-10 w-[74px] place-items-center rounded-[10px] border px-2 transition-shadow",
                  on ? "border-brand/60 shadow-md" : "border-line shadow-sm",
                  n.conn.chip === "dark" ? "bg-[#0d131b]" : "bg-white"
                )}
              >
                {/* fill + object-contain: the supplied assets range from 1:1 to
                    5.6:1, and only a fixed box with contain fits them all. */}
                <span className="relative block h-[22px] w-full">
                  {/* unoptimized: these are already tiny, hand-picked brand
                      assets drawn at 74px, so there is nothing for the
                      optimizer to save — and on Netlify it becomes a serverless
                      call that returns 500 on a cold start and only succeeds on
                      the retry, which showed up as a connector logo missing in
                      production. Served straight from the CDN they cannot fail,
                      and netlify.toml already caches /connectors/* for a day. */}
                  <Image src={n.conn.logo} alt="" fill sizes="74px" unoptimized className="object-contain" />
                </span>
                <span className={cn("absolute -end-1 -top-1 size-2.5 rounded-full ring-2 ring-bg", s.dot)} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Readout — the graph's detail lands here rather than in a tooltip, so
          it works the same on touch as on a pointer. */}
      <div className="mt-1 min-h-[52px] rounded-[10px] border border-line bg-surface/50 px-3 py-2.5">
        {shown ? (
          <div className="rise">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[12.5px] font-medium text-ink">
                <span className="bidi">{shown.name}</span>
              </p>
              <span className="shrink-0 text-[11px] text-ink-3">
                {STATE[shown.status].label} · {shown.lastSync}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
              {shown.kind}
              {shown.objects !== null && (
                <>
                  {" · "}
                  <span className="num">{new Intl.NumberFormat("en-US").format(shown.objects)}</span>
                  {" records"}
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="pt-1.5 text-center text-[11.5px] text-ink-3">
            Select a system to see what flows from it
          </p>
        )}
      </div>
    </div>
  );
}
