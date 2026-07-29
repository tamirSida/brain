"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  faArrowUp,
  faCheck,
  faCircleNotch,
  faMicrophone,
  faStop,
  faTrashCan,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";
import { useDictation } from "@/lib/useDictation";
import type { Metric } from "@/lib/ai/schemas";

/**
 * Phone remote for the dashboard.
 *
 * One input, one thread — no mode switch. Asking a question and then saying
 * "תוסיף את זה ללוח" has to work, and that only holds if both go through the
 * same conversation: a mode toggle would make the second sentence ambiguous,
 * and separate endpoints would mean the edit never sees the answer it refers
 * to. The model decides which it was.
 *
 * Voice first: the mic is the largest target on the page, dictation runs
 * continuously so the speaker decides when they are finished, and the
 * transcript is visible while it forms.
 */

const IDEAS = ["מה מחכה לי היום?", "תוסיף תזרים חודשי", "כמה רכבים החברה מחכירה?"];

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** Set on assistant turns that changed the board. */
  edited?: boolean;
  /** True while the answer is still in flight. */
  pending?: boolean;
}

export function RemoteClient({
  boardId,
  owner,
  metrics: initial,
}: {
  boardId: string;
  owner: string;
  metrics: Metric[];
}) {
  const [metrics, setMetrics] = useState(initial);
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef<HTMLInputElement>(null);
  const tail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread]);

  async function run(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setInput("");

    // Everything said so far, so "add that to the dashboard" can resolve
    // against the answer that preceded it.
    const history = thread
      .filter((t) => !t.pending)
      .map((t) => ({ role: t.role, content: t.content }));

    setThread((t) => [
      ...t,
      { role: "user", content: body },
      { role: "assistant", content: "", pending: true },
    ]);

    try {
      const res = await apiFetch(`/api/board/${boardId}/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "הבקשה נכשלה");

      if (data.metrics) setMetrics(data.metrics);
      setThread((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { role: "assistant", content: data.reply, edited: Boolean(data.metrics) }
            : turn
        )
      );
      // The buzz is the confirmation that matters when the user is looking at
      // the wall screen rather than at the phone.
      navigator.vibrate?.(data.metrics ? 35 : 20);
    } catch (e) {
      // Drop the optimistic pair and give the text back rather than stranding
      // a question with no answer under it.
      setThread((t) => t.slice(0, -2));
      setInput(body);
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  const mic = useDictation({
    // Continuous: the speaker decides when they are done, not the recogniser's
    // pause detection. Tapping again ends it and sends.
    continuous: true,
    onPartial: setInput,
    onFinal: (text) => void run(text),
  });

  const listening = mic.listening;
  const problem = error ?? mic.error;

  return (
    <main className="relative min-h-dvh overflow-x-clip pb-10">
      <div className="horizon-wash" />

      <div className="relative mx-auto w-full max-w-[440px] px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Image
            src="/ofek-logo.svg"
            alt="אופק אחזקות"
            width={70}
            height={25}
            priority
            className="brand-mark opacity-90"
          />
          <p className="text-[11.5px] text-ink-3">
            הלוח של <span className="text-ink-2">{owner}</span>
          </p>
        </header>

        <section className="mt-9 text-center">
          <h1 className="text-[22px] font-light tracking-tight text-ink">איך אפשר לעזור?</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            שאל שאלה, או תגיד מה להוסיף ללוח. המסך יתעדכן מיד.
          </p>
        </section>

        {/* Mic — the primary action, sized to be hit without looking. */}
        <div className="mt-8 grid place-items-center">
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (!mic.supported) {
                typed.current?.focus();
                return;
              }
              mic.start();
            }}
            disabled={busy}
            aria-label={listening ? "סיים ושלח" : "התחל הכתבה"}
            className={cn(
              "grid size-24 place-items-center rounded-full border-2 transition-colors",
              busy
                ? "cursor-wait border-line bg-surface text-ink-3"
                : listening
                  ? "border-risk bg-risk/10 text-risk"
                  : "border-brand/40 bg-brand/8 text-brand hover:bg-brand/14"
            )}
          >
            <Icon
              icon={busy ? faCircleNotch : listening ? faStop : faMicrophone}
              className={cn("text-[30px]", busy && "animate-spin")}
            />
          </button>
          <p className="mt-3 min-h-5 text-[12.5px] text-ink-3">
            {busy
              ? "חושב…"
              : listening
                ? "מקשיב… לחץ שוב כדי לסיים ולשלוח"
                : mic.supported
                  ? "או הקלד למטה"
                  : "הכתבה לא זמינה כאן — הקלד למטה"}
          </p>
        </div>

        {/* The transcript as it forms. Seeing the words appear is what tells
            the speaker the mic is actually live. */}
        {listening && (
          <div className="rise mt-4 rounded-[12px] border border-risk/40 bg-risk/5 px-4 py-3">
            <p className="flex items-center gap-2 text-[11px] font-medium text-risk">
              <span className="size-1.5 animate-pulse rounded-full bg-risk" />
              מקליט
            </p>
            <p className="mt-1.5 min-h-6 text-[15px] leading-relaxed text-ink">
              {input || <span className="text-ink-3">דבר עכשיו…</span>}
            </p>
          </div>
        )}

        {/* Typed fallback */}
        <div className="mt-4 flex items-center gap-1 rounded-full border border-line bg-surface p-1.5 focus-within:border-brand/70">
          <input
            ref={typed}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void run(input)}
            placeholder={listening ? "מקשיב…" : "שאל, או תגיד מה להוסיף…"}
            className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-[14.5px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void run(input)}
            disabled={!input.trim() || busy}
            aria-label="שלח"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
              input.trim() && !busy
                ? "bg-brand text-brand-on hover:bg-brand-hi"
                : "cursor-not-allowed bg-surface-2 text-ink-3"
            )}
          >
            <Icon icon={faArrowUp} className="text-[14px]" />
          </button>
        </div>

        {thread.length === 0 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {IDEAS.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => void run(i)}
                  disabled={busy}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
                >
                  {i}
                </button>
              </li>
            ))}
          </ul>
        )}

        {problem && (
          <p
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-[10px] border border-risk/40 bg-risk/8 px-3 py-2.5 text-[13px] text-risk"
          >
            <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
            {problem}
          </p>
        )}

        {/* The conversation — questions, answers and edit confirmations in one
            place, because that is the order they actually happened in. */}
        {thread.length > 0 && (
          <section className="mt-7 space-y-3">
            {thread.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="text-[12.5px] text-ink-3">
                  {t.content}
                </p>
              ) : t.pending ? (
                <p key={i} className="flex items-center gap-2 text-[13px] text-ink-3">
                  <Icon icon={faCircleNotch} className="animate-spin" />
                  חושב…
                </p>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "rise rounded-[12px] border px-3 py-2.5",
                    t.edited ? "border-ok/40 bg-ok/8" : "border-line bg-surface/60"
                  )}
                >
                  {t.edited && (
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ok">
                      <Icon icon={faCheck} />
                      הלוח עודכן
                    </p>
                  )}
                  <Markdown text={t.content} className="text-[13.5px] text-ink" />
                </div>
              )
            )}
            <div ref={tail} />
          </section>
        )}

        {/* What's on the board now, with one-tap removal. */}
        <section className="mt-9">
          <h2 className="mb-2 text-[12.5px] font-medium text-ink-2">
            על הלוח כרגע <span className="num text-ink-3">({metrics.length})</span>
          </h2>
          <ul className="space-y-2">
            {metrics.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-[10px] border border-line bg-surface/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{m.title}</p>
                  <p className="num truncate text-[11.5px] text-ink-3">{m.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void run(`הסר את המדד "${m.title}" מהלוח`)}
                  disabled={busy}
                  aria-label={`הסר ${m.title}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-risk/10 hover:text-risk disabled:opacity-40"
                >
                  <Icon icon={faTrashCan} className="text-[13px]" />
                </button>
              </li>
            ))}
            {metrics.length === 0 && (
              <li className="rounded-[10px] border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-ink-3">
                הלוח ריק. תגיד מה להוסיף.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
