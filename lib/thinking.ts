"use client";

import { useSyncExternalStore } from "react";

/**
 * "The brain is working" — one bit, shared across the tree.
 *
 * The composer and the connector graph are siblings rendered by a server
 * component, so there is no natural provider to hang a context on. A module
 * singleton read through useSyncExternalStore reaches both without
 * restructuring the page around a client boundary.
 *
 * It's a counter, not a boolean: two requests can overlap, and the last one to
 * finish should be the one that stops the animation.
 */

let active = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Mark work as started; call the returned function when it ends. */
export function beginThinking(): () => void {
  active += 1;
  emit();
  let done = false;
  return () => {
    // Guard against a caller ending twice — that would unbalance the counter
    // and leave the graph animating forever.
    if (done) return;
    done = true;
    active = Math.max(0, active - 1);
    emit();
  };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useThinking(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active > 0,
    // The server never animates.
    () => false
  );
}
