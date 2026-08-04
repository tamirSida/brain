import { z } from "zod";
import raw from "@/config/workspace.json";

/**
 * The shared demo workspace: one calendar and one mailbox that every user sees.
 *
 * Dates live in the config as `dayOffset` relative to today and are resolved
 * at read time, so "yesterday's meeting" is genuinely yesterday whenever the
 * demo is run — not a date that quietly goes stale.
 */

export const RSVP = ["accepted", "declined", "tentative", "needsAction"] as const;
export type Rsvp = (typeof RSVP)[number];

const AttendeeSchema = z.object({
  name: z.string(),
  email: z.string(),
  rsvp: z.enum(RSVP),
  organizer: z.boolean().optional(),
});

const AttachmentSchema = z.object({
  name: z.string(),
  kind: z.enum(["pptx", "xlsx", "pdf", "doc"]),
  /** How the file is reachable — this maps to what the APIs can actually do. */
  source: z.enum(["attached", "meet-transcript"]),
  /** Sub-header in the viewer: page count, author, duration. */
  meta: z.string().optional(),
  /** The file's contents. Rendered in the viewer *and* fed to the model, so a
   *  summary of a file is grounded in what the user can open and read. */
  sections: z
    .array(z.object({ title: z.string(), lines: z.array(z.string()) }))
    .default([]),
});

const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  dayOffset: z.number(),
  start: z.string(),
  end: z.string(),
  location: z.string(),
  platform: z.enum(["google", "microsoft"]),
  attendees: z.array(AttendeeSchema),
  attachments: z.array(AttachmentSchema),
});

const MailSchema = z.object({
  id: z.string(),
  from: z.object({ name: z.string(), email: z.string() }),
  subject: z.string(),
  preview: z.string(),
  dayOffset: z.number(),
  time: z.string(),
  unread: z.boolean(),
  hasAttachment: z.boolean(),
  attachment: z.string().optional(),
});

const WorkspaceSchema = z.object({
  organizer: z.object({ name: z.string(), email: z.string() }),
  events: z.array(EventSchema),
  mail: z.array(MailSchema),
});

const result = WorkspaceSchema.safeParse(raw);
if (!result.success) {
  throw new Error(
    `config/workspace.json is invalid: ${result.error.issues
      .map((i) => `${i.path.join(".")} — ${i.message}`)
      .join("; ")}`
  );
}
const workspace = result.data;

export type WorkspaceFile = z.infer<typeof AttachmentSchema>;
export type WorkspaceEvent = z.infer<typeof EventSchema> & { date: string; dayLabel: string };
export type WorkspaceMail = z.infer<typeof MailSchema> & { date: string; dayLabel: string };

function resolve(offset: number): { date: string; dayLabel: string } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  // Local date, NOT toISOString(): local midnight is the previous day in UTC,
  // which silently shifted every event back by one.
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

  const label =
    offset === 0
      ? "Today"
      : offset === 1
        ? "Tomorrow"
        : offset === -1
          ? "Yesterday"
          : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d);

  return { date: iso, dayLabel: label };
}

export const workspaceOwner = workspace.organizer;

export function getEvents(): WorkspaceEvent[] {
  return workspace.events
    .map((e) => ({ ...e, ...resolve(e.dayOffset) }))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function getMail(): WorkspaceMail[] {
  return workspace.mail
    .map((m) => ({ ...m, ...resolve(m.dayOffset) }))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export const RSVP_LABEL: Record<Rsvp, string> = {
  accepted: "accepted",
  declined: "declined",
  tentative: "tentative",
  needsAction: "no reply",
};

/** One attachment rendered as text, contents included. */
export function fileText(f: WorkspaceFile): string {
  const head = `  File: ${f.name} [${
    f.source === "attached" ? "attached to the event" : "auto-generated transcript"
  }${f.meta ? ` · ${f.meta}` : ""}]`;
  const body = f.sections
    .map((s) => `    ${s.title}:\n${s.lines.map((l) => `      · ${l}`).join("\n")}`)
    .join("\n");
  return body ? `${head}\n${body}` : head;
}

/**
 * Flattened text of the whole workspace, injected into the chat system prompt
 * so answers are grounded in this data rather than disclaimed.
 */
export function workspaceContext(): string {
  const events = getEvents()
    .map((e) => {
      const who = e.attendees
        .map((a) => `${a.name} <${a.email}> — ${RSVP_LABEL[a.rsvp]}${a.organizer ? " (organizer)" : ""}`)
        .join("; ");
      // Full file contents, not just names — otherwise "summarise the
      // transcript" has nothing to summarise and the model has to decline.
      const files = e.attachments.length
        ? e.attachments.map((f) => `\n${fileText(f)}`).join("")
        : "no attachments";
      const plat = e.platform === "microsoft" ? "Outlook/Teams" : "Google";
      return `- ${e.dayLabel} ${e.date} ${e.start}–${e.end} | ${e.title} | ${e.location} | ${plat}\n  Attendees: ${who}\n  Files: ${files}`;
    })
    .join("\n");

  const mail = getMail()
    .map(
      (m) =>
        `- ${m.dayLabel} ${m.time} | from ${m.from.name} <${m.from.email}> | ${m.subject}${
          m.hasAttachment ? ` | attachment: ${m.attachment}` : ""
        }${m.unread ? " | unread" : ""}\n  ${m.preview}`
    )
    .join("\n");

  return `<calendar>\n${events}\n</calendar>\n\n<mail>\n${mail}\n</mail>`;
}
