"use client";

import { useSyncExternalStore } from "react";

import { apiFetch } from "@/lib/http";
import type { Metric } from "@/lib/ai/schemas";
import type { PhoneTurn } from "@/lib/types";

/**
 * One poll of the board, shared by everything on the dashboard that needs it.
 *
 * The metric row and the ask box both react to phone activity, and before this
 * they each ran their own interval — two requests every 1.5s for the same JSON,
 * and two clocks that could disagree about whether a turn had landed. A module
 * singleton gives them one request and one answer.
 *
 * Polling rather than a Firestore listener, for the same reason as the API
 * route: the store falls back to an in-memory map when Firestore is
 * unreachable, and onSnapshot would go silent exactly then — mid-demo, on
 * someone else's network.
 */

export interface BoardFeed {
  metrics: Metric[] | null;
  receiving: boolean;
  turns: PhoneTurn[];
}

const EMPTY: BoardFeed = { metrics: null, receiving: false, turns: [] };

let state: BoardFeed = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
/** Refcount, so the last component to unmount is the one that stops the poll. */
let readers = 0;

function emit(next: BoardFeed) {
  // Reference equality is what useSyncExternalStore compares, so only publish
  // when something actually changed — otherwise every poll re-renders the board
  // and restarts each card's entrance animation.
  if (
    state.receiving === next.receiving &&
    JSON.stringify(state.metrics) === JSON.stringify(next.metrics) &&
    JSON.stringify(state.turns) === JSON.stringify(next.turns)
  ) {
    return;
  }
  state = next;
  for (const l of listeners) l();
}

async function poll(boardId: string) {
  try {
    const res = await apiFetch(`/api/board/${boardId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    emit({
      metrics: data.metrics ?? null,
      receiving: Boolean(data.receiving),
      turns: Array.isArray(data.phoneTurns) ? data.phoneTurns : [],
    });
  } catch {
    // A dropped poll is not worth surfacing; the next one catches up.
  }
}

/** Subscribe to the board. Returns a teardown for the caller's effect. */
export function watchBoard(boardId: string): () => void {
  readers += 1;
  if (!timer) {
    void poll(boardId);
    timer = setInterval(() => void poll(boardId), 1500);
  }
  return () => {
    readers -= 1;
    if (readers <= 0 && timer) {
      clearInterval(timer);
      timer = null;
      readers = 0;
      state = EMPTY;
    }
  };
}

export function useBoardFeed(): BoardFeed {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY
  );
}
