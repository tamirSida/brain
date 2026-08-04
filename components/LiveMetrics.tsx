"use client";

import { useEffect, useRef } from "react";

import { faMobileScreenButton } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { MetricLayout } from "@/components/MetricLayout";
import { cn } from "@/lib/cn";
import type { Metric } from "@/lib/ai/schemas";
import type { LayoutId } from "@/lib/layouts";
import { beginThinking } from "@/lib/thinking";
import { useBoardFeed, watchBoard } from "@/lib/boardFeed";

/**
 * The metric row, kept in step with edits made from the phone.
 *
 * Only the *signal* that a request arrived lives here — a badge above the row,
 * and the board receding while the model works. The question and its answer go
 * under the ask box instead, where they accumulate into a conversation; showing
 * them here as well would put the same exchange on screen twice.
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
  const feed = useBoardFeed();
  const endThinking = useRef<(() => void) | null>(null);

  useEffect(() => watchBoard(boardId), [boardId]);

  // Derived, not copied into state: `initial` is the server-rendered board, so
  // the first paint is never empty, and the feed takes over once it has polled.
  // Mirroring it into state would mean a second render on every poll for no
  // gain — and the feed only publishes when the metrics actually changed, so
  // card entrance animations are not restarted by an unrelated update.
  const metrics = feed.metrics ?? initial;

  // Drive the same "working" signal the composer uses, so the brain reacts to a
  // phone edit exactly as it does to a typed question.
  useEffect(() => {
    if (feed.receiving && !endThinking.current) {
      endThinking.current = beginThinking();
    } else if (!feed.receiving && endThinking.current) {
      endThinking.current();
      endThinking.current = null;
    }
  }, [feed.receiving]);

  // Never leave the brain animating because the page navigated mid-edit.
  useEffect(
    () => () => {
      endThinking.current?.();
      endThinking.current = null;
    },
    []
  );

  const receiving = feed.receiving;

  return (
    <div className="relative">
      {receiving && (
        <p className="rise mb-3 flex items-center gap-2 rounded-full border border-brand/40 bg-brand/8 px-3 py-1.5 text-[12px] font-medium text-brand-hi">
          <Icon icon={faMobileScreenButton} className="text-[11px]" />
          Receiving a request from your phone…
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
              Working on your request from mobile
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
