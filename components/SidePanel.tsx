"use client";

import { useEffect, useState } from "react";
import { faCalendarDay, faXmark } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

/**
 * The connectors + agenda column.
 *
 * Desktop (lg+): a static left pane, always visible.
 * Mobile: a slide-over sheet behind a button, so the lock-screen metaphor on
 * the main column stays uncluttered.
 */
export function SidePanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Escape closes, and background scroll is locked while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-10 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-ctl)] border border-line text-[14px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink lg:hidden"
      >
        <Icon icon={faCalendarDay} className="text-[13px]" />
        היומן והמערכות המחוברות
      </button>

      {/* Desktop: static column that fills the shell so its contents can
          own their own scrolling. */}
      <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">{children}</div>

      {/* Mobile: slide-over */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="סגור"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="היומן והמערכות המחוברות"
            className={cn(
              "rise absolute inset-y-0 start-0 w-[min(24rem,92vw)] overflow-y-auto",
              "border-e border-line bg-bg p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[14px] font-medium text-ink">היומן והמערכות</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Icon icon={faXmark} className="text-[16px]" />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
