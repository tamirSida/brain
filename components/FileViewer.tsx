"use client";

import { useEffect } from "react";
import {
  faFileExcel,
  faFileLines,
  faFilePdf,
  faFilePowerpoint,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import type { WorkspaceFile } from "@/lib/workspace";

/**
 * Opens an attachment as a readable document.
 *
 * The contents come from config/workspace.json — the same text the model is
 * given — so what the user reads here and what the agent summarises are the
 * same document, not two independently invented ones.
 */

const KIND = {
  pptx: { icon: faFilePowerpoint, tint: "text-[#d24726]", label: "Deck" },
  xlsx: { icon: faFileExcel, tint: "text-[#1d7044]", label: "Spreadsheet" },
  pdf: { icon: faFilePdf, tint: "text-[#c8102e]", label: "PDF" },
  doc: { icon: faFileLines, tint: "text-[#2b579a]", label: "Document" },
} as const;

export function FileViewer({ file, onClose }: { file: WorkspaceFile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const kind = KIND[file.kind];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        className="rise relative flex max-h-[86dvh] w-full max-w-[560px] flex-col rounded-t-[var(--radius-card)] border border-line bg-bg shadow-2xl sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className={`mt-0.5 text-[20px] ${kind.tint}`}>
            <Icon icon={kind.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-ink">{file.name}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
              {kind.label}
              {file.meta && ` · ${file.meta}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
          >
            <Icon icon={faXmark} className="text-[16px]" />
          </button>
        </div>

        {/* The page itself — a light sheet in both themes, like a real doc. */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
            {file.sections.map((s) => (
              <section key={s.title}>
                <h3 className="text-[13px] font-medium text-ink">{s.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {s.lines.map((l) => (
                    <li
                      key={l}
                      className="flex gap-2 text-[13px] leading-relaxed text-ink-2"
                    >
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-line-strong" />
                      <span className="bidi">{l}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {file.sections.length === 0 && (
              <p className="text-[13px] text-ink-3">No preview for this file.</p>
            )}
          </div>

          <p className="mt-3 text-center text-[11px] text-ink-3">
            Sample file — opened from the calendar event.
          </p>
        </div>
      </div>
    </div>
  );
}
