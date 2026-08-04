/**
 * The capability registry.
 *
 * Every entry here maps to a real, documented Gmail / Microsoft Graph /
 * Calendar endpoint. Nothing is listed that the APIs cannot actually do — the
 * UI only ever offers what's in this file.
 *
 * tier:
 *   read  — read-only, safe to run without confirmation
 *   draft — produces something a human reviews before it goes anywhere
 *   send  — actually sends mail or notifies real people; always confirmed
 */

export type Tier = "read" | "draft" | "send";
export type Platform = "google" | "microsoft" | "both";

export interface AgentAction {
  id: string;
  label: string;
  tier: Tier;
  platform: Platform;
  /** The real endpoint(s) behind it. */
  api: string;
  /** OAuth scope required. */
  scope: string;
  /** Honest limitation shown in the UI when it matters. */
  caveat?: string;
}

export const AGENT_ACTIONS: AgentAction[] = [
  {
    id: "search-mail",
    label: "Search mail by sender, date, subject or attachment",
    tier: "read",
    platform: "both",
    api: "Gmail messages.list?q= · Graph /me/messages $search",
    scope: "gmail.readonly · Mail.Read",
  },
  {
    id: "list-events",
    label: "Show today's or this week's meetings with invitees and their RSVP",
    tier: "read",
    platform: "both",
    api: "Calendar events.list · Graph /me/calendarView",
    scope: "calendar.readonly · Calendars.Read",
    caveat: "RSVP is who accepted the invitation, not who actually attended.",
  },
  {
    id: "event-attachment",
    label: "Locate the file attached to a meeting",
    tier: "read",
    platform: "both",
    api: "Calendar events.get → attachments[]",
    scope: "calendar.readonly + drive.readonly",
    caveat:
      "Works only if the file was explicitly attached to the meeting, or is an auto-generated transcript or recording. A file shared in the meeting chat is not reachable through the API.",
  },
  {
    id: "find-file",
    label: "Find files edited or shared around the time of a meeting",
    tier: "read",
    platform: "both",
    api: "Drive files.list?q= · Graph /search/query",
    scope: "drive.readonly · Files.Read",
    caveat: "A heuristic over time window and participants — an informed guess, not a certain lookup.",
  },
  {
    id: "free-slots",
    label: "Find open time slots across every participant",
    tier: "read",
    platform: "both",
    api: "Calendar freeBusy.query · Graph findMeetingTimes",
    scope: "calendar.freebusy · Calendars.Read.Shared",
  },
  {
    id: "attendance",
    label: "Actual attendance report for a Teams meeting",
    tier: "read",
    platform: "microsoft",
    api: "Graph /me/onlineMeetings/{id}/attendanceReports",
    scope: "OnlineMeetingArtifact.Read.All",
    caveat:
      "Microsoft only, and only for the meeting organizer. Requires tenant admin consent. Google Meet has no equivalent interface.",
  },
  {
    id: "draft-reply",
    label: "Draft a reply for your review",
    tier: "draft",
    platform: "both",
    api: "Gmail drafts.create · Graph POST /me/messages",
    scope: "gmail.compose · Mail.ReadWrite",
  },
  {
    id: "draft-to-attendees",
    label: "Draft mail with an attachment to everyone who accepted",
    tier: "draft",
    platform: "both",
    api: "events.get → attendees[] → drafts.create",
    scope: "calendar.readonly + gmail.compose",
    caveat: "Recipients are whoever accepted the invitation — not whoever actually attended.",
  },
  {
    id: "propose-event",
    label: "Propose a new meeting before sending it",
    tier: "draft",
    platform: "both",
    api: "held client-side until confirmed",
    scope: "—",
    caveat: "The Calendar API has no draft state for an event, so the proposal is held locally until you confirm.",
  },
  {
    id: "send-mail",
    label: "Send the mail",
    tier: "send",
    platform: "both",
    api: "Gmail messages.send · Graph /me/sendMail",
    scope: "gmail.send · Mail.Send",
    caveat: "There is no undo once sent.",
  },
  {
    id: "create-event",
    label: "Create a meeting and send invitations",
    tier: "send",
    platform: "both",
    api: "events.insert?sendUpdates=all · Graph POST /me/events",
    scope: "calendar.events · Calendars.ReadWrite",
    caveat: "Notifies every invitee.",
  },
  {
    id: "update-event",
    label: "Update or cancel an existing meeting",
    tier: "send",
    platform: "both",
    api: "events.patch / events.delete · Graph PATCH|DELETE /me/events/{id}",
    scope: "calendar.events · Calendars.ReadWrite",
    caveat: "Notifies every invitee.",
  },
];

export const TIER_LABEL: Record<Tier, string> = {
  read: "read",
  draft: "draft",
  send: "send",
};
