"use client";

import { useRef, useState } from "react";
import {
  faChevronLeft,
  faChevronRight,
  faCircleNotch,
  faLocationDot,
  faPaperclip,
  faVideo,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { FileViewer } from "@/components/FileViewer";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/cn";
import type { WorkspaceEvent, WorkspaceFile } from "@/lib/workspace";

const PLATFORM = {
  google: { bar: "bg-[#4285F4]", label: "Google Calendar" },
  microsoft: { bar: "bg-[#0078D4]", label: "Outlook" },
} as const;

export function Agenda({ events }: { events: WorkspaceEvent[] }) {
  // Past is noise for a prep surface — today forward only.
  const upcoming = events.filter((e) => e.dayOffset >= 0);

  const days = upcoming.reduce<{ date: string; label: string; items: WorkspaceEvent[] }[]>(
    (acc, e) => {
      const day = acc.find((d) => d.date === e.date);
      if (day) day.items.push(e);
      else acc.push({ date: e.date, label: e.dayLabel, items: [e] });
      return acc;
    },
    []
  );

  const scroller = useRef<HTMLDivElement>(null);

  function page(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    // RTL: scrollLeft runs negative, so "next" is a negative delta.
    el.scrollBy({ left: dir * el.clientWidth * (document.dir === "rtl" ? -1 : 1), behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">היומן שלך</h2>
          {days.length > 1 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => page(-1)}
                aria-label="ימים קודמים"
                className="grid size-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                <Icon icon={faChevronRight} className="text-[11px]" />
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                aria-label="ימים הבאים"
                className="grid size-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                <Icon icon={faChevronLeft} className="text-[11px]" />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal day panes — native swipe on mobile, arrows on desktop. */}
        <div
          ref={scroller}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {days.map((d) => (
            <div key={d.date} className="w-full shrink-0 snap-start">
              <p className="mb-2 flex items-baseline gap-2 text-[12px] font-medium text-ink-2">
                {d.label}
                <span className="num text-[11px] text-ink-3">{d.date}</span>
              </p>
              <ul className="space-y-2">
                {d.items.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-[11.5px] leading-relaxed text-ink-3">
        יומן לדוגמה, משותף לכל המשתמשים.
      </p>
    </div>
  );
}

function EventCard({ event }: { event: WorkspaceEvent }) {
  const [prep, setPrep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<WorkspaceFile | null>(null);
  const online = /teams|meet/i.test(event.location);

  async function runPrep() {
    if (prep) return setPrep(null); // toggle closed
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "הכנה נכשלה");
      setPrep(data.brief);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface/60">
      <div className="flex gap-3 p-3">
        <span
          className={cn("mt-0.5 w-1 shrink-0 rounded-full", PLATFORM[event.platform].bar)}
          title={PLATFORM[event.platform].label}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13.5px] font-medium text-ink">{event.title}</p>
            <span className="num shrink-0 text-[11.5px] text-ink-2">
              {event.start}–{event.end}
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] text-ink-3">
            <Icon icon={online ? faVideo : faLocationDot} className="text-[10px]" />
            <span className="bidi truncate">{event.location}</span>
            <span className="text-line-strong">·</span>
            <span className="num">{event.attendees.length}</span> משתתפים
          </p>

          {event.attachments.map((f) => (
            <FileChip key={f.name} file={f} onOpen={() => setOpenFile(f)} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={runPrep}
        disabled={busy}
        className={cn(
          "flex min-h-11 w-full items-center justify-center gap-2 border-t border-line px-3",
          "text-[12.5px] font-medium transition-colors",
          prep ? "text-ink-2 hover:text-ink" : "text-brand hover:bg-surface-2"
        )}
      >
        <Icon icon={busy ? faCircleNotch : faWandMagicSparkles} className={cn("text-[12px]", busy && "animate-spin")} />
        {busy ? "חושב…" : prep ? "סגור את התדריך" : "הכן אותי לישיבה"}
      </button>

      {err && <p className="border-t border-line px-3 py-2 text-[12px] text-risk">{err}</p>}

      {prep && (
        <div className="rise border-t border-line bg-bg-2/60 px-3 py-3">
          <Markdown text={prep} className="text-[12.5px] text-ink" />
        </div>
      )}

      {openFile && <FileViewer file={openFile} onClose={() => setOpenFile(null)} />}
    </li>
  );
}

function FileChip({ file, onOpen }: { file: WorkspaceFile; onOpen: () => void }) {
  const note = file.source === "meet-transcript" ? "תמלול אוטומטי" : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1.5 flex min-h-9 w-full items-center gap-1.5 rounded-[8px] border border-line bg-bg-2/60 px-2 text-start text-[11px] text-ink-2 transition-colors hover:border-brand/50 hover:text-ink"
    >
      <Icon icon={faPaperclip} className="text-[10px]" />
      <span className="truncate">{file.name}</span>
      {note && (
        <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] text-ink-3">{note}</span>
      )}
    </button>
  );
}
