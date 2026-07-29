"use client";

import { useEffect, useRef, useState } from "react";

import { faMobileScreenButton } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { MetricLayout } from "@/components/MetricLayout";
import { cn } from "@/lib/cn";
import type { Metric } from "@/lib/ai/schemas";
import type { LayoutId } from "@/lib/layouts";
import { beginThinking } from "@/lib/thinking";

import { apiFetch } from "@/lib/http";
/**
 * The metric row, kept in step with edits made from the phone.
 *
 * Polls rather than subscribing: the session store falls back to an in-memory
 * map when Firestore is unreachable, and a Firestore listener would go quiet
 * in exactly that case. A 1.5s poll of a tiny JSON payload is invisible to the
 * viewer and works whichever backend is live.
 *
 * `initial` is the server-rendered board, so the first paint is never empty.
 */
export function LiveMetrics({
  boardId,
  initial,
  layout,
}: {
  boardId: string;
  initial: Metric[];
  layout: LayoutId;
}) {
  const [metrics, setMetrics] = useState(initial);
  const [receiving, setReceiving] = useState(false);
  // Compare the metrics themselves, not updatedAt: the "an edit is coming"
  // marker also bumps updatedAt, and re-setting identical metrics would
  // restart every card's entrance animation.
  const shape = useRef(JSON.stringify(initial));
  const endThinking = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await apiFetch(`/api/board/${boardId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;

        const next = JSON.stringify(data.metrics);
        if (next !== shape.current) {
          shape.current = next;
          setMetrics(data.metrics);
        }

        setReceiving(Boolean(data.receiving));
        // Drive the same "working" signal the composer uses, so the brain
        // reacts to a phone edit exactly as it does to a typed question.
        if (data.receiving && !endThinking.current) {
          endThinking.current = beginThinking();
        } else if (!data.receiving && endThinking.current) {
          endThinking.current();
          endThinking.current = null;
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one will catch up.
      }
    }

    void poll();
    const t = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(t);
      // Never leave the brain animating because the page navigated mid-edit.
      endThinking.current?.();
      endThinking.current = null;
    };
  }, [boardId]);

  return (
    <div className="relative">
      {receiving && (
        <p className="rise mb-3 flex items-center gap-2 rounded-full border border-brand/40 bg-brand/8 px-3 py-1.5 text-[12px] font-medium text-brand-hi">
          <Icon icon={faMobileScreenButton} className="text-[11px]" />
          מקבל עדכון מהטלפון…
        </p>
      )}

      {/* While an edit is arriving the board recedes and a spinner takes the
          foreground: the point is to pull every eye in the room to the screen
          a beat before the new card lands. */}
      <div
        aria-busy={receiving}
        className={cn(
          "transition-all duration-500",
          receiving && "scale-[0.985] opacity-35 blur-[1.5px] saturate-50"
        )}
      >
        <MetricLayout metrics={metrics} layout={layout} />
      </div>

      {receiving && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rise flex flex-col items-center gap-3">
            <span className="relative grid size-14 place-items-center">
              <span className="absolute inset-0 rounded-full border-2 border-brand/25" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
              <Icon icon={faMobileScreenButton} className="text-[15px] text-brand-hi" />
            </span>
            <span className="rounded-full bg-bg/80 px-3 py-1 text-[12px] font-medium text-ink-2 backdrop-blur-sm">
              מעדכן את הלוח…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
