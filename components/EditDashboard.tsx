"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  faCircleNotch,
  faSliders,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { LayoutBlurb, LayoutPicker } from "@/components/LayoutPicker";
import { cn } from "@/lib/cn";
import type { LayoutId } from "@/lib/layouts";

import { apiFetch } from "@/lib/http";
const IDEAS = [
  "Cash flow, budget variance, and occupancy",
  "Permit status, construction schedules, and guarantee exposure",
  "NOI by asset, open collections, and tenant mix",
];

/**
 * Re-prompt the dashboard: the user restates what matters and the three
 * metrics are regenerated from scratch.
 */
export function EditDashboard({ focus, layout }: { focus: string; layout: LayoutId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(focus);
  const [pick, setPick] = useState<LayoutId>(layout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy]);

  const rebuilding = text.trim() !== focus.trim();

  async function save() {
    if (text.trim().length < 12 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus: text, layout: pick }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The update failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText(focus);
          setPick(layout);
          setError(null);
          setOpen(true);
        }}
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        <Icon icon={faSliders} className="text-[11px]" />
        Edit metrics
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => !busy && setOpen(false)}
            className="absolute inset-0 bg-black/55"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editing metrics"
            className="rise relative w-full max-w-[520px] rounded-t-[var(--radius-card)] border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[var(--radius-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-medium text-ink">What matters to you?</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  Change the text and I’ll rebuild all three metrics and how each one is shown.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Icon icon={faXmark} className="text-[16px]" />
              </button>
            </div>

            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              className="mt-4 w-full resize-none rounded-[var(--radius-ctl)] border border-line bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink placeholder:text-ink-3 focus:border-brand/70 focus:outline-none disabled:opacity-60"
              placeholder="For example: monthly cash flow, budget variance across active projects, and occupancy"
            />

            <div className="mt-5">
              <p className="text-[12.5px] font-medium text-ink-2">Layout</p>
              <div className="mt-2">
                <LayoutPicker value={pick} onChange={setPick} disabled={busy} />
              </div>
              <LayoutBlurb value={pick} />
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {IDEAS.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setText(i)}
                    disabled={busy}
                    className="rounded-full border border-line px-3 py-1.5 text-[11.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
                  >
                    {i}
                  </button>
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 text-[12.5px] text-risk">
                <Icon icon={faTriangleExclamation} className="mt-0.5" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={save}
              disabled={busy || text.trim().length < 12}
              className={cn(
                "mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-ctl)]",
                "text-[15px] font-medium transition-colors",
                busy || text.trim().length < 12
                  ? "cursor-not-allowed bg-surface-2 text-ink-3"
                  : "bg-brand text-brand-on hover:bg-brand-hi"
              )}
            >
              {busy && <Icon icon={faCircleNotch} className="animate-spin text-[13px]" />}
              {busy ? "Thinking…" : rebuilding ? "Update the metrics" : "Apply the layout"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
