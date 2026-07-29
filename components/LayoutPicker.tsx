"use client";

import { LAYOUT_OPTIONS, type LayoutId } from "@/lib/layouts";
import { cn } from "@/lib/cn";

/**
 * Layout chooser, shared by onboarding and the edit sheet.
 *
 * Each option shows a schematic rather than a name alone — the difference
 * between these layouts is spatial, and a label like "grid" doesn't convey it.
 */
export function LayoutPicker({
  value,
  onChange,
  disabled,
}: {
  value: LayoutId;
  onChange: (id: LayoutId) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {LAYOUT_OPTIONS.map((o) => {
        const on = o.id === value;
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onChange(o.id)}
              disabled={disabled}
              aria-pressed={on}
              className={cn(
                "flex h-full w-full flex-col gap-2 rounded-[10px] border p-2.5 text-start transition-colors",
                on
                  ? "border-brand bg-brand/8"
                  : "border-line hover:border-line-strong disabled:opacity-50"
              )}
            >
              <span
                aria-hidden
                className="flex h-[46px] w-full gap-1 rounded-[6px] bg-bg-2/70 p-1.5"
              >
                {o.sketch.map((b, i) => (
                  <span key={i} style={{ flexGrow: b.w }} className="flex flex-col gap-[3px]">
                    {/* header bar, then the chart block; `full` adds the
                        insight line underneath. */}
                    <span
                      className={cn("h-[3px] rounded-[1px]", on ? "bg-brand/45" : "bg-line-strong")}
                    />
                    <span
                      className={cn(
                        "flex-1 rounded-[2px]",
                        on ? "bg-brand/30" : "bg-line-strong/55"
                      )}
                    />
                    {b.full && (
                      <span
                        className={cn(
                          "h-[3px] rounded-[1px]",
                          on ? "bg-brand/45" : "bg-line-strong"
                        )}
                      />
                    )}
                  </span>
                ))}
              </span>
              <span className={cn("text-[12px] font-medium", on ? "text-ink" : "text-ink-2")}>
                {o.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The blurb for the current choice — one line, below the row. */
export function LayoutBlurb({ value }: { value: LayoutId }) {
  const o = LAYOUT_OPTIONS.find((x) => x.id === value);
  return <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">{o?.blurb}</p>;
}
