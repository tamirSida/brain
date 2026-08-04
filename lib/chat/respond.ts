import "server-only";

import { anthropic, MODEL } from "@/lib/ai/client";
import { connectors } from "@/lib/connectors";
import { workspaceContext } from "@/lib/workspace";
import { AGENT_ACTIONS, TIER_LABEL } from "@/lib/agent/actions";
import type { Conversation, ChatMessage } from "./types";
import type { Profile } from "@/lib/types";

/* ===========================================================================
   CONTEXT & TOKEN MANAGEMENT

   The whole conversation is persisted, but the model only ever sees a window:

     [ system ] + [ rolling summary of old turns ] + [ last N turns verbatim ]

   When the verbatim tail grows past WINDOW_TOKENS, the oldest half of it is
   folded into `summary` and dropped from the tail. Cost per turn therefore
   stays roughly flat as a thread grows, instead of rising linearly because the
   full history is resent every time.

   Sonnet 5 has a 1M context, so nothing here would actually overflow in a
   demo — the window exists so the pattern is right, and so the token numbers
   shown in the UI are real rather than decorative.
   =========================================================================== */

/** Fold older turns into the summary once the verbatim tail exceeds this. */
const WINDOW_TOKENS = 6000;
/** Never send fewer than this many recent turns verbatim. */
const MIN_TAIL = 6;

/** ~4 chars/token is a reasonable English estimate for windowing.
 *  Only used to decide *when* to summarise — displayed numbers come from the
 *  API's own usage report, never from this. */
function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Exported so the phone remote answers from exactly the same grounding as
 *  the desktop chat — one prompt, not two that drift apart. */
export function systemPrompt(profile: Profile): string {
  // Each system with what it holds and how much — enough for the model to
  // answer about Yardi or Monday concretely instead of disclaiming them.
  const systems = connectors
    .map((c) => {
      const count =
        c.objects === null
          ? "not connected"
          : `${new Intl.NumberFormat("en-US").format(c.objects)} records synced`;
      const holds = c.entities.length ? `\n    holds: ${c.entities.join(", ")}` : "";
      return `- ${c.name} — ${c.kind} · ${count} · ${c.lastSync ?? "never synced"}${holds}`;
    })
    .join("\n");
  // Caveats travel with the capability — otherwise the model lists an action
  // as available and silently drops the limitation that makes it conditional.
  const actions = AGENT_ACTIONS.map((a) => {
    // Single source of tier vocabulary — see TIER_LABEL in lib/agent/actions.ts
    const tier = TIER_LABEL[a.tier];
    const plat =
      a.platform === "microsoft" ? " · Microsoft only" : a.platform === "google" ? " · Google only" : "";
    return `- ${a.label} (${tier}${plat})${a.caveat ? `\n    limitation: ${a.caveat}` : ""}`;
  }).join("\n");

  return `You are the Organization Brain for Lightstone, a US real estate
investment, development and management firm.
You are assisting ${profile.name}, ${profile.title}.

The connected systems and what each one holds:
${systems}

What you can actually do against Gmail / Outlook / Calendar:
${actions}

Below are the user's calendar and mailbox. Answer from this data — it is your
real data.
${workspaceContext()}

Rules:
- Answer in English, briefly and to the point. No superlatives, no emoji.
- **Always give a complete, useful answer.** Never write "I don't have access",
  "I don't have the contents", "I'm not able to", "I can't read", or "in this
  environment". Those phrasings are forbidden. This is a demo environment and
  all of its data is fictional. The file contents are above — read from them and
  summarise them. If some particular detail is not in the data, fill it in
  yourself, plausibly and consistently with the rest, and carry on. Do not stop
  to apologise and do not open with a caveat.
- **Every system in the list above is connected and you are pulling from it.**
  If asked "what data is in Yardi", "what does the budget look like in SAP", or
  "what's open in Monday" — answer as though you queried it just now: name
  entities, fields and concrete figures that suit a US real estate firm and that
  stay consistent with the calendar, the mail, and the record count shown beside
  each system.
  Each system lists what it holds — lean on that when the question is about that
  system, and answer from it.
  This applies to every system in the list without exception, not only Yardi.
  Never say a system is "not available in this environment" — all of them are.
- The demo data reads positive: projects are on schedule, results are ahead of
  forecast, there is no crisis. Do not invent delays, overruns or problems that
  are not in the data.
- Do not promise an action that is not in the list above, and where an action
  carries a limitation, state that limitation next to the action itself — not
  separately and not later.
  Those limitations are about what the system is *able to do*, not about what
  you *know*. Do not conflate the two.
- Specifically: it is not possible to know who actually *attended* a Google
  Calendar meeting. Only who was invited and who accepted. A real attendance
  report exists only in Teams, only for the organizer, and only with tenant
  admin consent.
- Before any action that sends, show the full draft (recipients, subject, body,
  attachment) and ask for confirmation. Never claim you have sent it; this is a
  prototype and sending is simulated.`;
}

interface RespondResult {
  reply: ChatMessage;
  /** True when older turns were folded into the summary on this turn. */
  compacted: boolean;
  windowSize: number;
}

export async function respond(
  convo: Conversation,
  profile: Profile
): Promise<RespondResult> {
  const client = anthropic();

  // --- 1. Decide the window -------------------------------------------------
  let tail = convo.messages.slice(convo.summarizedUpTo);
  let compacted = false;

  const tailTokens = tail.reduce((n, m) => n + estimate(m.content), 0);
  if (tailTokens > WINDOW_TOKENS && tail.length > MIN_TAIL) {
    const foldCount = Math.max(1, Math.floor((tail.length - MIN_TAIL) / 2) + 1);
    const toFold = tail.slice(0, foldCount);
    convo.summary = await summarise(convo.summary, toFold);
    convo.summarizedUpTo += foldCount;
    tail = convo.messages.slice(convo.summarizedUpTo);
    compacted = true;
  }

  // --- 2. Build the request -------------------------------------------------
  const system = convo.summary
    ? `${systemPrompt(profile)}\n\n<conversation summary so far>\n${convo.summary}\n</summary>`
    : systemPrompt(profile);

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      // The stable prefix is cached; the volatile tail sits after it.
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: tail.map((m) => ({ role: m.role, content: m.content })),
  });

  if (res.stop_reason === "max_tokens") {
    throw new Error("The answer was cut off. Try asking something more specific.");
  }

  const text = res.content.find((b) => b.type === "text");
  const reply: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: text && text.type === "text" ? text.text : "No answer was returned.",
    ts: new Date().toISOString(),
    tokens: {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
    },
  };

  return { reply, compacted, windowSize: tail.length };
}

/** Fold a batch of old turns into the running summary. */
async function summarise(
  previous: string | null,
  batch: ChatMessage[]
): Promise<string> {
  const client = anthropic();
  const transcript = batch.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "Summarise a conversation so it can carry context forward. Keep facts, decisions, figures and names. Drop pleasantries and repetition. Write in the third person, 8 lines at most.",
    messages: [
      {
        role: "user",
        content: previous
          ? `Previous summary:\n${previous}\n\nThe conversation since:\n${transcript}\n\nReturn one merged summary.`
          : `Summarise:\n${transcript}`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : (previous ?? "");
}

/** First user line becomes the thread title. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 42 ? clean : `${clean.slice(0, 41)}…`;
}
