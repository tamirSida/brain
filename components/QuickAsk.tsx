"use client";

import Link from "next/link";
import { useState } from "react";
import {
  faArrowUp,
  faArrowUpRightFromSquare,
  faCircleNotch,
  faMicrophone,
  faStop,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/cn";


/**
 * Inline "quick ask" on the home screen. Answers land here; the full thread
 * (with history) lives at /chat, and this links straight into it.
 */
export function QuickAsk() {
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  async function ask(text: string, voice = false) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAsked(q);
    setAnswer(null);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message: q, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שליחה נכשלה");
      setConvoId(data.conversationId);
      setAnswer(data.reply.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
      setAsked(null);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) return;
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Ctor = (W.SpeechRecognition ?? W.webkitSpeechRecognition) as
      | (new () => Record<string, unknown>)
      | undefined;
    if (!Ctor) {
      setError("הדפדפן הזה לא תומך בהכתבה קולית. נסה Chrome.");
      return;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const r: any = new (Ctor as any)();
    r.lang = "he-IL";
    r.interimResults = true;
    let finalText = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    r.onerror = () => {
      setListening(false);
      setError("ההכתבה נכשלה. בדוק הרשאת מיקרופון.");
    };
    r.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (t) void ask(t, true);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
    setListening(true);
    r.start();
  }

  return (
    // Mobile: pinned to the bottom of the viewport, thumb-reachable and always
    // available while the metric stack scrolls behind it.
    // Desktop (lg+): back into normal document flow — there's no reach problem
    // on a pointer device, and a floating bar would just cover the column.
    <section
      className={cn(
        "z-30",
        "fixed inset-x-0 bottom-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:static lg:z-auto lg:mt-3 lg:p-0"
      )}
    >
      <div className="mx-auto w-full max-w-[440px] lg:max-w-none">
        <div className="notif flex flex-col p-4 shadow-lg shadow-black/10 sm:p-5 lg:shadow-none">
      <div className="order-1 flex items-end gap-2">
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "מקשיב" : "הכתבה קולית"}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full border transition-colors",
            listening
              ? "border-risk bg-risk/10 text-risk"
              : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
          )}
        >
          <Icon icon={listening ? faStop : faMicrophone} className="text-[14px]" />
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void ask(input)}
          placeholder={listening ? "מקשיב…" : "שאל אותי משהו על היומן או הדואר…"}
          className="min-h-11 flex-1 rounded-[var(--radius-ctl)] border border-line bg-bg-2/60 px-4 text-[14px] text-ink placeholder:text-ink-3 focus:border-brand/70 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void ask(input)}
          disabled={!input.trim() || busy}
          aria-label="שלח"
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
            input.trim() && !busy
              ? "bg-brand text-brand-on hover:bg-brand-hi"
              : "cursor-not-allowed bg-surface-2 text-ink-3"
          )}
        >
          <Icon icon={faArrowUp} className="text-[14px]" />
        </button>
      </div>

      {error && (
        <p role="alert" className="order-3 mt-3 flex items-start gap-2 text-[12.5px] text-risk">
          <Icon icon={faTriangleExclamation} className="mt-0.5" />
          {error}
        </p>
      )}

      {asked && (
        // On mobile the bar sits at the bottom, so the answer has to open
        // upward — order-first — and stay capped so it can't fill the screen.
        <div
          className={cn(
            "order-first max-h-[42vh] overflow-y-auto",
            "mb-3 border-b border-line pb-3",
            "lg:order-last lg:mb-0 lg:mt-4 lg:border-b-0 lg:border-t lg:pb-0 lg:pt-3"
          )}
        >
          <p className="text-[12.5px] text-ink-3">{asked}</p>
          {busy ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-3">
              <Icon icon={faCircleNotch} className="animate-spin" />
              חושב…
            </p>
          ) : (
            answer && (
              <>
                <Markdown text={answer} className="mt-2 text-[13.5px] text-ink" />
                {convoId && (
                  <Link
                    href="/chat"
                    className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-brand hover:underline"
                  >
                    המשך בשיחה מלאה
                    <Icon icon={faArrowUpRightFromSquare} className="text-[10px]" />
                  </Link>
                )}
              </>
            )
          )}
        </div>
      )}
        </div>
      </div>
    </section>
  );
}
