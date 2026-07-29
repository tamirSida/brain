import { NextResponse } from "next/server";
import { z } from "zod";

import { anthropic, hasApiKey, MODEL } from "@/lib/ai/client";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";
import { fileText, getEvents, getMail, RSVP_LABEL } from "@/lib/workspace";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60s and does not allow raising it.
export const maxDuration = 60;

const Body = z.object({ eventId: z.string() });

const SYSTEM = `אתה מכין מנהל בכיר בחברת נדל״ן ואחזקות ישראלית לקראת פגישה.
כתוב תדריך קצר בעברית, ענייני, בלי סופרלטיבים ובלי אימוג'י.

מבנה קבוע:
1. שורה אחת: מה מטרת הפגישה.
2. "רקע" — 2–3 נקודות מהדואר והחומרים שרלוונטיות לפגישה הזו.
3. "מה צריך להחליט" — 1–3 נקודות קונקרטיות.
4. "לשים לב" — סיכון או נקודה פתוחה אחת, אם יש.

בסס את התדריך על החומרים והדואר שניתנו לך — כולל תוכן הקבצים המצורף.
לעולם אל תכתוב ״אין לי גישה״, ״חסר מידע״ או ״לא ניתן לי התוכן״. זו סביבת הדגמה וכל הנתונים בדיוניים;
אם פרט חסר, השלם אותו באופן סביר ועקבי עם השאר והמשך.
התמונה בנתונים חיובית — פרויקטים בלוח הזמנים ותוצאות מעל התחזית. אל תמציא עיכובים או חריגות.
״לשים לב״ הוא הזדמנות או נקודה פתוחה לסגירה, לא בשורה רעה.
עד 140 מילים.`;

export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "no session" }, { status: 401 });
  const session = await readSession(email);
  if (!session) return NextResponse.json({ error: "no profile" }, { status: 401 });

  if (!hasApiKey()) {
    return NextResponse.json({ error: "חסר ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });

  const event = getEvents().find((e) => e.id === parsed.data.eventId);
  if (!event) return NextResponse.json({ error: "האירוע לא נמצא" }, { status: 404 });

  const attendees = event.attendees
    .map((a) => `${a.name} (${a.email}) — ${RSVP_LABEL[a.rsvp]}${a.organizer ? ", מארגן" : ""}`)
    .join("; ");
  // Contents, not just filenames — a brief that can quote the deck is the
  // whole point of the button.
  const files = event.attachments.length
    ? `\n${event.attachments.map(fileText).join("\n")}`
    : "אין";

  // Only mail from the surrounding week is relevant to a prep brief.
  const mail = getMail()
    .slice(0, 6)
    .map((m) => `- ${m.dayLabel} | ${m.from.name}: ${m.subject} — ${m.preview}`)
    .join("\n");

  const prompt = `הפגישה:
${event.dayLabel} ${event.date}, ${event.start}–${event.end}
נושא: ${event.title}
מיקום: ${event.location}
משתתפים: ${attendees}
חומרים מצורפים: ${files}

דואר אחרון בתיבה:
${mail}

מי שמתכונן: ${session.profile.name}, ${session.profile.title}.`;

  try {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "התדריך נקטע" }, { status: 502 });
    }
    const block = res.content.find((b) => b.type === "text");
    return NextResponse.json({
      brief: block && block.type === "text" ? block.text : "לא התקבל תדריך.",
    });
  } catch (err) {
    console.error("[prep]", err);
    return NextResponse.json({ error: "הכנת התדריך נכשלה" }, { status: 502 });
  }
}
