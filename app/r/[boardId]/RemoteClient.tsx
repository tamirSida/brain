"use client";

import { useEffect, useRef, useState } from "react";
import {
  faCheck,
  faChevronDown,
  faCircleNotch,
  faMicrophone,
  faPaperPlane,
  faTrashCan,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { BrandMark } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";
import { useDictation } from "@/lib/useDictation";
import type { Metric } from "@/lib/ai/schemas";

/**
 * Phone remote, shaped as a messaging app.
 *
 * A chat is the right form here because that is what it is: you say something,
 * it answers or acts, and the history is the context for the next thing you
 * say. Borrowing WhatsApp's conventions — outgoing bubbles in green on the
 * inline-end side, a fixed composer, hold-to-talk with cancel or send — means
 * nobody needs the interface explained.
 *
 * One thread, no modes: asking "how many cars does the company lease?" and then
 * saying "add that to the board" only works if both go through the same
 * conversation.
 */

const IDEAS = ["What's waiting for me today?", "Add monthly cash flow", "How many cars does the company lease?"];

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** Set on assistant turns that changed the board. */
  edited?: boolean;
  /** True while the answer is still in flight. */
  pending?: boolean;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const [board, setBoard] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const typed = useRef<HTMLInputElement>(null);
  const tail = useRef<HTMLDivElement>(null);

  async function run(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setInput("");

    // Everything said so far, so "add that to the dashboard" resolves against
    // the answer that preceded it.
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
      if (!res.ok) throw new Error(data.error ?? "That request failed");

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
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const mic = useDictation({
    // Continuous: the speaker decides when they are done, not the recogniser's
    // pause detection.
    continuous: true,
    onPartial: setInput,
    onFinal: (text) => void run(text),
  });

  const listening = mic.listening;

  // Recording timer, exactly as a voice note shows one.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!listening) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(t);
  }, [listening]);

  useEffect(() => {
    tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, listening]);

  const problem = error ?? mic.error;
  const canSend = input.trim().length > 0 && !busy;

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-none bg-bg">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          {/* Red on a white disc, matching the graph hub on the desktop board.
              The mark doubles as the thinking indicator here — an arc orbits it
              while a turn is in flight. */}
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
            <BrandMark className="size-5 text-[#D01E3B]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-ink">Organization Brain</p>
            <p className="truncate text-[11px] text-ink-3">{owner}’s board</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setBoard((b) => !b)}
          aria-expanded={board}
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-ink-2 transition-colors hover:text-ink"
        >
          Board
          <span className="num text-ink-3">{metrics.length}</span>
          <Icon
            icon={faChevronDown}
            className={cn("text-[10px] transition-transform", board && "rotate-180")}
          />
        </button>
      </header>

      {/* Board panel — collapsed by default; the conversation is the main event. */}
      {board && (
        <div className="max-h-[38vh] shrink-0 overflow-y-auto border-b border-line bg-bg-2 px-4 py-3">
          <ul className="space-y-2">
            {metrics.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{m.title}</p>
                  <p className="num truncate text-[11.5px] text-ink-3">{m.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void run(`Remove the "${m.title}" metric from the board`)}
                  disabled={busy}
                  aria-label={`Remove ${m.title}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-risk/10 hover:text-risk disabled:opacity-40"
                >
                  <Icon icon={faTrashCan} className="text-[13px]" />
                </button>
              </li>
            ))}
            {metrics.length === 0 && (
              <li className="rounded-[10px] border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-ink-3">
                The board is empty. Say what to add.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Conversation */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="horizon-wash" />

        {thread.length === 0 && (
          <div className="relative mt-6 text-center">
            <h1 className="text-[20px] font-light tracking-tight text-ink">How can I help?</h1>
            <ul className="mt-5 flex flex-wrap justify-center gap-2">
              {IDEAS.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void run(i)}
                    disabled={busy}
                    className="rounded-full border border-line bg-surface px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {i}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="relative flex flex-col gap-2">
          {thread.map((t, i) =>
            t.role === "user" ? (
              // self-end is inline-end, which under dir="ltr" is the right —
              // where WhatsApp puts your own messages.
              <div
                key={i}
                className="bubble-out max-w-[85%] self-end rounded-[14px] rounded-ee-[4px] px-3 py-2 text-[14.5px] leading-relaxed shadow-sm"
              >
                {t.content}
              </div>
            ) : t.pending ? (
              <div
                key={i}
                className="bubble-in flex max-w-[85%] items-center gap-2 self-start rounded-[14px] rounded-es-[4px] px-3 py-2.5 text-[13px] text-ink-3 shadow-sm"
              >
                <Icon icon={faCircleNotch} className="animate-spin" />
                Thinking…
              </div>
            ) : (
              <div
                key={i}
                className={cn(
                  "bubble-in max-w-[85%] self-start rounded-[14px] rounded-es-[4px] px-3 py-2 shadow-sm",
                  t.edited && "border-ok/50"
                )}
              >
                {t.edited && (
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ok">
                    <Icon icon={faCheck} />
                    Board updated
                  </p>
                )}
                <Markdown text={t.content} className="text-[14.5px]" />
              </div>
            )
          )}
          <div ref={tail} />
        </div>

        {problem && (
          <p
            role="alert"
            className="relative mt-3 flex items-start gap-2 rounded-[10px] border border-risk/40 bg-risk/8 px-3 py-2.5 text-[12.5px] text-risk"
          >
            <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
            {problem}
          </p>
        )}
      </div>

      {/* Composer — pinned, like a messaging app. */}
      <div className="shrink-0 border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        {listening ? (
          // Recording bar: discard on the left, timer in the middle, send on
          // the right. Stopping and sending are the same action, deliberately —
          // a separate "stop" then "send" is the step people forget.
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={mic.cancel}
              aria-label="Cancel recording"
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-risk/10 hover:text-risk"
            >
              <Icon icon={faTrashCan} className="text-[16px]" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-risk" />
              <span className="num shrink-0 text-[13px] text-risk">{clock(elapsed)}</span>
              <span className="truncate text-[13px] text-ink-2">
                {input || "Listening…"}
              </span>
            </div>

            <button
              type="button"
              onClick={mic.stop}
              aria-label="Finish and send"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-ok text-white transition-colors"
            >
              <Icon icon={faPaperPlane} className="text-[15px]" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex min-h-11 flex-1 items-center rounded-full border border-line bg-bg-2 px-4 focus-within:border-brand/70">
              <input
                ref={typed}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void run(input)}
                placeholder="Message"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>

            {/* One button that becomes send once there is something to send —
                the WhatsApp swap, and it keeps the thumb in one place. */}
            <button
              type="button"
              onClick={() => {
                if (canSend) return void run(input);
                setError(null);
                if (!mic.supported) return typed.current?.focus();
                mic.start();
              }}
              disabled={busy}
              aria-label={canSend ? "Send" : "Record"}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
                busy ? "bg-surface-2 text-ink-3" : "bg-ok text-white"
              )}
            >
              <Icon
                icon={busy ? faCircleNotch : canSend ? faPaperPlane : faMicrophone}
                className={cn("text-[16px]", busy && "animate-spin")}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
