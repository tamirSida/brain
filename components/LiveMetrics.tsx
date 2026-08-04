"use client";

import { useEffect, useRef, useState } from "react";

import { faMobileScreenButton } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { MetricLayout } from "@/components/MetricLayout";
import { cn } from "@/lib/cn";
import { Markdown } from "@/components/Markdown";
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
interface LastTurn {
  question: string;
  /** Absent while the model is still working on it. */
  answer?: string;
  at: string;
}

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
  const [turn, setTurn] = useState<LastTurn | null>(null);
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
        setTurn(data.lastTurn ?? null);
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
      {/* What was said from the phone, and what came back.

          The room is looking at this screen, not at the handset — so the
          question has to appear here or half the exchange is invisible to
          everyone but the person holding the phone. The question shows as soon
          as it is asked; the answer replaces the spinner when it lands, and
          both clear themselves a couple of minutes later. */}
      {turn && (
        <div className="rise mb-3 rounded-[var(--radius-card)] border border-brand/30 bg-brand/6 px-4 py-3">
          <p className="flex items-start gap-2 text-[13px] text-ink">
            <Icon icon={faMobileScreenButton} className="mt-[3px] shrink-0 text-[11px] text-brand-hi" />
            <span className="font-medium">{turn.question}</span>
          </p>

          {turn.answer ? (
            <div className="mt-2 border-t border-brand/15 pt-2 text-[13px] text-ink-2">
              <Markdown text={turn.answer} />
            </div>
          ) : (
            <p className="mt-1.5 ps-[19px] text-[12px] text-ink-3">Thinking…</p>
          )}
        </div>
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
              Working on your request from mobile
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
