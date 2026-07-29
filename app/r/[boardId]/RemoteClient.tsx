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
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";
import type { Metric } from "@/lib/ai/schemas";

/**
 * Phone remote for the dashboard.
 *
 * Voice first: the demo is someone speaking a sentence and the wall screen
 * changing. The mic is the largest target on the page and fires the request
 * the moment dictation ends, so the flow is one tap and one sentence — no
 * "now press send" step between speaking and seeing the result.
 */

const IDEAS = ["תוסיף תזרים חודשי", "תוסיף אחוזי אכלוס", "תוסיף סטטוס היתרי בנייה"];

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
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const recog = useRef<any>(null);

  useEffect(() => () => recog.current?.abort?.(), []);

  async function run(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    setInput("");
    try {
      const res = await apiFetch(`/api/board/${boardId}/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "העדכון נכשל");
      setMetrics(data.metrics);
      setReply(data.reply);
      // A short buzz is the confirmation that matters when the user is looking
      // at the wall screen and not at the phone.
      navigator.vibrate?.(35);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recog.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Ctor = (W.SpeechRecognition ?? W.webkitSpeechRecognition) as
      | (new () => Record<string, unknown>)
      | undefined;
    if (!Ctor) {
      setError("הדפדפן הזה לא תומך בהכתבה. נסה Chrome, או הקלד.");
      return;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const r: any = new (Ctor as any)();
    recog.current = r;
    r.lang = "he-IL";
    r.interimResults = true;
    let final = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInput((final + interim).trim());
    };
    r.onerror = () => {
      setListening(false);
      setError("ההכתבה נכשלה. בדוק הרשאת מיקרופון.");
    };
    r.onend = () => {
      setListening(false);
      // Send on end of speech: the point of the demo is one gesture.
      const t = final.trim();
      if (t) void run(t);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
    setError(null);
    setListening(true);
    r.start();
  }

  return (
    <main className="relative min-h-dvh overflow-x-clip pb-8">
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

        <section className="mt-10 text-center">
          <h1 className="text-[22px] font-light tracking-tight text-ink">מה להוסיף ללוח?</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            לחץ על המיקרופון ותגיד מה חשוב לך לראות. המסך יתעדכן מיד.
          </p>
        </section>

        {/* Mic — the primary action, sized to be hit without looking. */}
        <div className="mt-9 grid place-items-center">
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            aria-label={listening ? "עצור והקלט" : "התחל הכתבה"}
            className={cn(
              "grid size-28 place-items-center rounded-full border-2 transition-colors",
              busy
                ? "cursor-wait border-line bg-surface text-ink-3"
                : listening
                  ? "border-risk bg-risk/10 text-risk"
                  : "border-brand/40 bg-brand/8 text-brand hover:bg-brand/14"
            )}
          >
            <Icon
              icon={busy ? faCircleNotch : listening ? faStop : faMicrophone}
              className={cn("text-[34px]", busy && "animate-spin")}
            />
          </button>
          <p className="mt-3 min-h-5 text-[12.5px] text-ink-3">
            {busy ? "חושב…" : listening ? "מקשיב…" : "או הקלד למטה"}
          </p>
        </div>

        {/* Typed fallback */}
        <div className="mt-4 flex items-center gap-1 rounded-full border border-line bg-surface p-1.5 focus-within:border-brand/70">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void run(input)}
            placeholder={listening ? "מקשיב…" : "למשל: תוסיף תזרים חודשי"}
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

        {reply && (
          <p className="rise mt-5 flex items-start gap-2 rounded-[10px] border border-ok/40 bg-ok/8 px-3 py-2.5 text-[13px] text-ok">
            <Icon icon={faCheck} className="mt-0.5 shrink-0" />
            {reply}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-[10px] border border-risk/40 bg-risk/8 px-3 py-2.5 text-[13px] text-risk"
          >
            <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
            {error}
          </p>
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
                  onClick={() => void run(`הסר את המדד "${m.title}"`)}
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
