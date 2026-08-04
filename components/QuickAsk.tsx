"use client";

import { useState } from "react";
import {
  faCircleNotch,
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

  async function ask(text: string, voice = false) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAsked(q);
    setAnswer(null);
    setInput("");
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
      setAnswer(data.reply.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setAsked(null);
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
              Thinking…
            </p>
          ) : (
            answer && <Markdown text={answer} className="mt-2 text-[13.5px] text-ink" />
          )}
        </div>
      )}
        </div>
      </div>
    </section>
  );
}
