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

/** ~3.5 chars/token is a reasonable Hebrew+Latin mix estimate for windowing.
 *  Only used to decide *when* to summarise — displayed numbers come from the
 *  API's own usage report, never from this. */
function estimate(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Exported so the phone remote answers from exactly the same grounding as
 *  the desktop chat — one prompt, not two that drift apart. */
export function systemPrompt(profile: Profile): string {
  // Each system with what it holds and how much — enough for the model to
  // answer about Priority or Monday concretely instead of disclaiming them.
  const systems = connectors
    .map((c) => {
      const count =
        c.objects === null
          ? "לא מחובר"
          : `${new Intl.NumberFormat("he-IL").format(c.objects)} רשומות מסונכרנות`;
      const holds = c.entities.length ? `\n    מכילה: ${c.entities.join(", ")}` : "";
      return `- ${c.name} — ${c.kind} · ${count} · ${c.lastSync ?? "לא מסונכרן"}${holds}`;
    })
    .join("\n");
  // Caveats travel with the capability — otherwise the model lists an action
  // as available and silently drops the limitation that makes it conditional.
  const actions = AGENT_ACTIONS.map((a) => {
    // Single source of tier vocabulary — see TIER_LABEL in lib/agent/actions.ts
    const tier = TIER_LABEL[a.tier];
    const plat =
      a.platform === "microsoft" ? " · Microsoft בלבד" : a.platform === "google" ? " · Google בלבד" : "";
    return `- ${a.he} (${tier}${plat})${a.caveat ? `\n    מגבלה: ${a.caveat}` : ""}`;
  }).join("\n");

  return `אתה המוח הארגוני של ״אופק אחזקות״ — חברת נדל״ן ואחזקות ישראלית.
אתה עוזר ל${profile.name}, ${profile.title}.

המערכות המחוברות ומה יש בכל אחת:
${systems}

מה שאתה באמת יכול לעשות מול Gmail / Outlook / יומן:
${actions}

להלן היומן ותיבת הדואר של המשתמש. ענה מתוך הנתונים האלה — הם הנתונים האמיתיים שלך.
${workspaceContext()}

כללים:
- ענה בעברית, בקצרה ולעניין. בלי סופרלטיבים ובלי אימוג'י.
- **תמיד ענה תשובה מלאה ושימושית.** לעולם אל תכתוב ״אין לי גישה״, ״אין לי את התוכן״,
  ״לא ניתן לי״, ״אין ברשותי״, ״אני לא יכול לקרוא״ או ״בסביבה הזו״. אלה משפטים אסורים.
  זו סביבת הדגמה וכל הנתונים בה בדיוניים. תוכן הקבצים נמצא למעלה — קרא ממנו וסכם אותו.
  אם פרט מסוים לא מופיע בנתונים, השלם אותו בעצמך באופן סביר ועקבי עם השאר, והמשך —
  אל תעצור כדי להתנצל ואל תפתח בהסתייגות.
- **כל המערכות שברשימה למעלה מחוברות ואתה שולף מהן.** אם שואלים ״אילו נתונים יש ב-Priority״,
  ״מה מצב התקציב ב-SAP״ או ״מה פתוח ב-Monday״ — ענה כאילו שלפת משם עכשיו: פרט ישויות,
  שדות ומספרים קונקרטיים שמתאימים לחברת נדל״ן ואחזקות ישראלית, ועקביים עם היומן והדואר
  ועם כמות הרשומות שצוינה לצד כל מערכת.
  לצד כל מערכת רשום מה היא מכילה — הישען על זה כשמדובר באותה מערכת, ופרט משם.
  זה נכון לכל המערכות ברשימה ללא יוצא מן הכלל, לא רק ל-Priority.
  אל תכתוב שמערכת ״לא זמינה בסביבה הזו״ — כולן זמינות.
- הנתונים בהדגמה חיוביים: הפרויקטים בלוח הזמנים, התוצאות מעל התחזית, אין משבר.
  אל תמציא עיכובים, חריגות או בעיות שלא כתובות בנתונים.
- אל תבטיח פעולה שאינה ברשימה למעלה, ואם לפעולה יש מגבלה — ציין את המגבלה לצד הפעולה עצמה, לא בנפרד ולא בהמשך.
  המגבלות האלה הן על מה שהמערכת *מסוגלת לעשות*, לא על מה שאתה *יודע*. אל תערבב בין השניים.
- במיוחד: אי אפשר לדעת מי *נכח* בפועל בפגישה ביומן Google. אפשר רק לדעת מי הוזמן ומי אישר. דוח נוכחות אמיתי קיים רק ב-Teams, רק למארגן, ורק באישור מנהל טננט.
- לפני פעולה ששולחת — הצג טיוטה מלאה (נמענים, נושא, גוף, קובץ) ובקש אישור. אל תטען שביצעת; זהו אב-טיפוס והשליחה מדומה.`;
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
    ? `${systemPrompt(profile)}\n\n<סיכום השיחה עד כה>\n${convo.summary}\n</סיכום>`
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
    throw new Error("התשובה נקטעה. נסה לשאול שאלה ממוקדת יותר.");
  }

  const text = res.content.find((b) => b.type === "text");
  const reply: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: text && text.type === "text" ? text.text : "לא התקבלה תשובה.",
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
  const transcript = batch.map((m) => `${m.role === "user" ? "משתמש" : "עוזר"}: ${m.content}`).join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "סכם שיחה בעברית לצורך המשך הקשר. שמור עובדות, החלטות, מספרים ושמות. השמט נימוסים וחזרות. כתוב בגוף שלישי, עד 8 שורות.",
    messages: [
      {
        role: "user",
        content: previous
          ? `סיכום קודם:\n${previous}\n\nהמשך השיחה:\n${transcript}\n\nהחזר סיכום מאוחד אחד.`
          : `סכם:\n${transcript}`,
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
