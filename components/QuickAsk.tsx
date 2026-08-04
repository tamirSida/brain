"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  faCircleNotch,
  faMobileScreenButton,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { Composer } from "@/components/Composer";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { withAttachment } from "@/lib/attach";
import { useDictation } from "@/lib/useDictation";
import { beginThinking } from "@/lib/thinking";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";
import { useBoardFeed, watchBoard } from "@/lib/boardFeed";

/**
 * The "quick ask" on the home screen, and the conversation it accumulates.
 *
 * Both halves of the exchange gather here — what is typed at the desk and what
 * is said into the phone — because they are one conversation about one board,
 * and the room is looking at this screen rather than at the handset. Anything
 * asked from the phone would otherwise be invisible to everyone except the
 * person holding it.
 *
 * Shaped as chat bubbles, matching the remote, so which side said what needs no
 * explaining. Phone turns carry a small handset marker; that is the only thing
 * distinguishing them.
 *
 * The full thread with history still lives at /chat; this is the surface view.
 */

interface Bubble {
  id: string;
  question: string;
  /** Absent while the answer is still being written. */
  answer?: string;
  at: string;
  from: "desk" | "phone";
}

export function QuickAsk({ boardId }: { boardId: string }) {
  const [input, setInput] = useState("");
  const [deskTurns, setDeskTurns] = useState<Bubble[]>([]);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feed = useBoardFeed();
  const tail = useRef<HTMLDivElement>(null);

  useEffect(() => watchBoard(boardId), [boardId]);

  // One thread in time order. The phone's turns are owned by the server and the
  // desk's by this component, so they are merged for display rather than kept
  // in a single list — neither side can see the other's until it lands.
  const thread = useMemo<Bubble[]>(() => {
    const phone: Bubble[] = feed.turns.map((t) => ({ ...t, from: "phone" as const }));
    return [...deskTurns, ...phone].sort((a, b) => a.at.localeCompare(b.at));
  }, [deskTurns, feed.turns]);

  // Follow the conversation as it grows, the way any chat does.
  useEffect(() => {
    tail.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread]);

  async function ask(text: string, voice = false) {
    const q = text.trim();
    if (!q || busy) return;
    const id = crypto.randomUUID();
    const at = new Date().toISOString();

    setBusy(true);
    setError(null);
    setInput("");
    setDeskTurns((t) => [...t, { id, question: q, at, from: "desk" }]);

    // The connector graph animates while this is in flight.
    const endThinking = beginThinking();
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message: q, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sending failed");
      setConvoId(data.conversationId);
      setDeskTurns((t) =>
        t.map((b) => (b.id === id ? { ...b, answer: data.reply.content } : b))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      // Drop the question rather than leaving it stranded under a spinner that
      // will never resolve.
      setDeskTurns((t) => t.filter((b) => b.id !== id));
    } finally {
      endThinking();
      setBusy(false);
    }
  }

  const mic = useDictation({
    onPartial: setInput,
    onFinal: (text) => void ask(text, true),
  });

  const listening = mic.listening;

  return (
    // Mobile: pinned to the bottom of the viewport, thumb-reachable and always
    // available while the metric stack scrolls behind it.
    // Desktop (lg+): back into normal document flow — there's no reach problem
    // on a pointer device, and a floating bar would just cover the column.
    <section
      className={cn(
        "z-30",
        "fixed inset-x-0 bottom-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        // Sits well clear of the metric row above it rather than tucked
        // under it — the composer should read as its own invitation.
        "lg:static lg:z-auto lg:mt-10 lg:p-0"
      )}
    >
      <div className="mx-auto w-full max-w-[440px] lg:max-w-none">
        <div className="notif flex flex-col p-4 shadow-lg shadow-black/10 sm:p-5 lg:shadow-none">
          <div className="order-1">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={(text, att) => void ask(withAttachment(text, att), false)}
              busy={busy}
              listening={listening}
              onMic={mic.start}
              placeholder="How can I help?"
            />
          </div>

          {(error ?? mic.error) && (
            <p role="alert" className="order-3 mt-3 flex items-start gap-2 text-[12.5px] text-risk">
              <Icon icon={faTriangleExclamation} className="mt-0.5" />
              {error ?? mic.error}
            </p>
          )}

          {thread.length > 0 && (
            // On mobile the bar sits at the bottom of the screen, so the
            // conversation has to open upward — order-first — and stay capped so
            // it can't fill the viewport. On desktop it reads downward, under
            // the composer, the way the request described.
            <div
              className={cn(
                "flex flex-col gap-2.5 overflow-y-auto",
                "order-first mb-3 max-h-[42vh] border-b border-line pb-3",
                "lg:order-last lg:mb-0 lg:mt-4 lg:max-h-[46vh] lg:border-b-0 lg:border-t lg:pb-0 lg:pt-4"
              )}
            >
              {thread.map((b) => (
                <div key={b.id} className="flex flex-col gap-1.5">
                  {/* Outgoing: the question, on the inline-end side. */}
                  <div className="flex justify-end">
                    <div className="bubble-out max-w-[85%] rounded-[14px] rounded-ee-[4px] px-3 py-2 text-[13px]">
                      {b.from === "phone" && (
                        <span className="mb-0.5 flex items-center gap-1.5 text-[10.5px] opacity-70">
                          <Icon icon={faMobileScreenButton} className="text-[9px]" />
                          from your phone
                        </span>
                      )}
                      {b.question}
                    </div>
                  </div>

                  {/* Incoming: the answer, or a spinner until it lands. */}
                  <div className="flex justify-start">
                    <div className="bubble-in max-w-[92%] rounded-[14px] rounded-es-[4px] px-3 py-2 text-[13px]">
                      {b.answer ? (
                        <Markdown text={b.answer} />
                      ) : (
                        <span className="flex items-center gap-2 text-ink-3">
                          <Icon icon={faCircleNotch} className="animate-spin text-[11px]" />
                          Thinking…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={tail} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
