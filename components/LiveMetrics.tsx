"use client";

import { useEffect, useRef, useState } from "react";

import { MetricLayout } from "@/components/MetricLayout";
import type { Metric } from "@/lib/ai/schemas";
import type { LayoutId } from "@/lib/layouts";

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
  const stamp = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await apiFetch(`/api/board/${boardId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        // Only swap on a genuine change — re-setting identical state would
        // restart every card's entrance animation on a 1.5s loop.
        if (data.updatedAt !== stamp.current) {
          stamp.current = data.updatedAt;
          setMetrics(data.metrics);
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
    };
  }, [boardId]);

  return <MetricLayout metrics={metrics} layout={layout} />;
}
