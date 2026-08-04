"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  faCircleNotch,
  faRotateRight,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

/**
 * Start the onboarding over from a blank slate. The board it produces
 * overwrites the current one (same email → same record), so this is guarded
 * behind a confirm step rather than firing on a single click.
 *
 * Nothing is destroyed here: `?fresh=1` only re-opens the onboarding form
 * past the "already onboarded" redirect. The old board survives untouched
 * until the new one is actually built and saved, so backing out is safe.
 */
export function ReonboardButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  function confirm() {
    setBusy(true);
    router.push("/onboarding?fresh=1");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Start over"
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[12px]",
          "text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        )}
      >
        <Icon icon={faRotateRight} className="text-[10px]" />
        Start over
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
            aria-label="Starting over"
            className="rise relative w-full max-w-[440px] rounded-t-[var(--radius-card)] border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[var(--radius-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-medium text-ink">Start over?</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  We’ll build a new home screen from scratch. The current board is replaced
                  entirely once you finish the new intake. Until then nothing is deleted.
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

            <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-ctl)] border border-warn/40 bg-warn/10 p-3 text-[12.5px] leading-relaxed text-warn">
              <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              The current metrics and settings are deleted when the new board is built.
            </p>

            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className={cn(
                "mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-ctl)]",
                "text-[15px] font-medium transition-colors",
                busy
                  ? "cursor-not-allowed bg-surface-2 text-ink-3"
                  : "bg-brand text-brand-on hover:bg-brand-hi"
              )}
            >
              {busy && <Icon icon={faCircleNotch} className="animate-spin text-[13px]" />}
              {busy ? "Opening…" : "Yes, start over"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
