"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  faBars,
  faChevronRight,
  faCircleNotch,
  faLayerGroup,
  faMicrophone,
  faPenToSquare,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { Composer } from "@/components/Composer";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { withAttachment } from "@/lib/attach";
import { beginThinking } from "@/lib/thinking";
import { cn } from "@/lib/cn";
import type { ChatMessage, ConversationMeta } from "@/lib/chat/types";

interface ContextInfo {
  compacted: boolean;
  windowSize: number;
  totalMessages: number;
  summarized: number;
  hasSummary: boolean;
}

const SUGGESTIONS = [
  "מה יש לי ביומן מחר ומי אישר הגעה?",
  "מצא את הקובץ שצורף לפגישת ההנהלה",
  "נסח טיוטת מייל לכל מי שאישר הגעה לישיבת התקציב",
  "מתי כולנו פנויים לפגישה של שעה השבוע?",
];

export function ChatClient({ firstName }: { firstName: string }) {
  const [threads, setThreads] = useState<ConversationMeta[]>([]);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextInfo | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [listening, setListening] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const params = useSearchParams();
  const prefill = params.get("q");

  useEffect(() => {
    void refreshThreads();
  }, []);

  // Arriving from a file chip or agenda link: ask immediately, once.
  const fired = useRef(false);
  useEffect(() => {
    if (!prefill || fired.current) return;
    fired.current = true;
    void send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function refreshThreads() {
    const res = await fetch("/api/chat");
    if (res.ok) setThreads((await res.json()).conversations ?? []);
  }

  async function openThread(id: string) {
    setDrawer(false);
    const res = await fetch(`/api/chat?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    setConvoId(conversation.id);
    setMessages(conversation.messages);
    setCtx(null);
  }

  function newThread() {
    setDrawer(false);
    setConvoId(null);
    setMessages([]);
    setCtx(null);
    setError(null);
  }

  async function send(text: string, voice = false) {
    const body = text.trim();
    if (!body || busy) return;

    setBusy(true);
    setError(null);
    setInput("");
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, role: "user", content: body, ts: new Date().toISOString(), voice },
    ]);

    const endThinking = beginThinking();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message: body, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שליחה נכשלה");

      setConvoId(data.conversationId);
      setMessages((m) => [...m.slice(0, -1), data.user, data.reply]);
      setCtx(data.context);
      void refreshThreads();
    } catch (err) {
      setMessages((m) => m.slice(0, -1));
      setInput(body);
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      endThinking();
      setBusy(false);
    }
  }

  /* --- Voice: Web Speech API, Hebrew. Degrades to a disabled button. ------ */
  function toggleMic() {
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const W = window as unknown as {
      SpeechRecognition?: new () => never;
      webkitSpeechRecognition?: new () => never;
    };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setError("הדפדפן הזה לא תומך בהכתבה קולית. נסה Chrome.");
      return;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const r: any = new (Ctor as any)();
    r.lang = "he-IL";
    r.interimResults = true;
    r.continuous = false;

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
      if (t) void send(t, true);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    recogRef.current = r;
    setListening(true);
    r.start();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---------------------------------------------------------- header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="שיחות קודמות"
          className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 lg:hidden"
        >
          <Icon icon={faBars} className="text-[15px]" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium">
          {convoId ? threads.find((t) => t.id === convoId)?.title ?? "שיחה" : "שיחה חדשה"}
        </h1>

        <button
          type="button"
          onClick={newThread}
          aria-label="שיחה חדשה"
          className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
        >
          <Icon icon={faPenToSquare} className="text-[15px]" />
        </button>

        <Link
          href="/dashboard"
          className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
          aria-label="חזרה למסך הבית"
        >
          <Icon icon={faChevronRight} className="text-[15px]" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* -------------------------------------------------------- threads */}
        <aside
          className={cn(
            "z-30 w-72 shrink-0 overflow-y-auto border-line bg-bg p-3 lg:block lg:border-s",
            drawer
              ? "fixed inset-y-0 end-0 block border-s shadow-2xl"
              : "hidden"
          )}
        >
          <p className="px-2 pb-2 text-[12px] font-medium text-ink-3">שיחות קודמות</p>
          {threads.length === 0 && (
            <p className="px-2 text-[13px] text-ink-3">אין עדיין שיחות שמורות.</p>
          )}
          <ul className="space-y-1">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  className={cn(
                    "w-full rounded-[10px] px-3 py-2.5 text-start transition-colors",
                    t.id === convoId ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"
                  )}
                >
                  <span className="block truncate text-[13.5px]">{t.title}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    <span className="num">{t.messageCount}</span> הודעות
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {drawer && (
          <button
            type="button"
            aria-label="סגור"
            onClick={() => setDrawer(false)}
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          />
        )}

        {/* ------------------------------------------------------- messages */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto w-full max-w-[680px]">
              {empty ? (
                <div className="pt-10">
                  <p className="text-[20px] font-light text-ink">
                    שלום {firstName}, מה נבדוק היום?
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                    אני מחובר ליומן ולדוא״ל של הקבוצה. אפשר לבקש ממני לחפש, לסכם או לנסח —
                    כל פעולה ששולחת משהו החוצה תוצג לאישורך קודם.
                  </p>
                  <ul className="mt-6 space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => void send(s)}
                          className="w-full rounded-[var(--radius-ctl)] border border-line bg-surface/60 px-4 py-3 text-start text-[13.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul className="space-y-4">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[86%] rounded-[16px] px-4 py-3 text-[14.5px] leading-relaxed",
                          m.role === "user"
                            ? "bg-brand text-brand-on"
                            : "border border-line bg-surface text-ink"
                        )}
                      >
                        {m.voice && (
                          <span className="mb-1 flex items-center gap-1.5 text-[11px] opacity-70">
                            <Icon icon={faMicrophone} />
                            הוכתב
                          </span>
                        )}
                        {m.role === "assistant" ? (
                          <Markdown text={m.content} />
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                    </li>
                  ))}
                  {busy && (
                    <li className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-[16px] border border-line bg-surface px-4 py-3 text-[13px] text-ink-3">
                        <Icon icon={faCircleNotch} className="animate-spin text-[13px]" />
                        חושב…
                      </div>
                    </li>
                  )}
                </ul>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* --------------------------------------------------- composer */}
          <div className="shrink-0 border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto w-full max-w-[680px]">
              {error && (
                <p
                  role="alert"
                  className="mb-2 flex items-start gap-2 rounded-[10px] border border-risk/40 bg-risk/8 px-3 py-2 text-[12.5px] text-risk"
                >
                  <Icon icon={faTriangleExclamation} className="mt-0.5" />
                  {error}
                </p>
              )}

              <Composer
                value={input}
                onChange={setInput}
                onSubmit={(text, att) => void send(withAttachment(text, att))}
                busy={busy}
                listening={listening}
                onMic={toggleMic}
                placeholder="שאל אותי משהו…"
                multiline
              />

              {/* Context accounting — real numbers from the API, not estimates */}
              {ctx && (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
                  <span className="flex items-center gap-1">
                    <Icon icon={faLayerGroup} />
                    נשלחו <span className="num">{ctx.windowSize}</span> מתוך{" "}
                    <span className="num">{ctx.totalMessages}</span> הודעות
                  </span>
                  {ctx.hasSummary && (
                    <span>
                      <span className="num">{ctx.summarized}</span> הודעות סוכמו והוצאו מהחלון
                    </span>
                  )}
                  {ctx.compacted && <span className="text-warn">ההקשר נדחס בפנייה הזו</span>}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
