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
  he: string;
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
    he: "חיפוש בדוא״ל לפי שולח, תאריך, נושא או קובץ מצורף",
    tier: "read",
    platform: "both",
    api: "Gmail messages.list?q= · Graph /me/messages $search",
    scope: "gmail.readonly · Mail.Read",
  },
  {
    id: "list-events",
    he: "הצגת פגישות היום/השבוע עם המוזמנים וסטטוס האישור שלהם",
    tier: "read",
    platform: "both",
    api: "Calendar events.list · Graph /me/calendarView",
    scope: "calendar.readonly · Calendars.Read",
    caveat: "סטטוס = מי אישר את ההזמנה, לא מי נכח בפועל.",
  },
  {
    id: "event-attachment",
    he: "איתור הקובץ המצורף לפגישה",
    tier: "read",
    platform: "both",
    api: "Calendar events.get → attachments[]",
    scope: "calendar.readonly + drive.readonly",
    caveat:
      "עובד רק אם הקובץ צורף לפגישה במפורש, או שמדובר בתמלול או בהקלטה שנוצרה אוטומטית. קובץ ששותף בצ'אט של הפגישה אינו נגיש דרך ה-API.",
  },
  {
    id: "find-file",
    he: "חיפוש קבצים שנערכו או שותפו סביב מועד הפגישה",
    tier: "read",
    platform: "both",
    api: "Drive files.list?q= · Graph /search/query",
    scope: "drive.readonly · Files.Read",
    caveat: "היוריסטיקה לפי חלון זמן ומשתתפים — ניחוש מושכל, לא שליפה ודאית.",
  },
  {
    id: "free-slots",
    he: "מציאת חלונות זמן פנויים לכל המשתתפים",
    tier: "read",
    platform: "both",
    api: "Calendar freeBusy.query · Graph findMeetingTimes",
    scope: "calendar.freebusy · Calendars.Read.Shared",
  },
  {
    id: "attendance",
    he: "דוח נוכחות בפועל לפגישת Teams",
    tier: "read",
    platform: "microsoft",
    api: "Graph /me/onlineMeetings/{id}/attendanceReports",
    scope: "OnlineMeetingArtifact.Read.All",
    caveat:
      "Microsoft בלבד, ורק למארגן הפגישה. דורש אישור מנהל טננט. ל-Google Meet אין ממשק מקביל.",
  },
  {
    id: "draft-reply",
    he: "ניסוח טיוטת תשובה לאישורך",
    tier: "draft",
    platform: "both",
    api: "Gmail drafts.create · Graph POST /me/messages",
    scope: "gmail.compose · Mail.ReadWrite",
  },
  {
    id: "draft-to-attendees",
    he: "טיוטת מייל עם קובץ מצורף לכל מי שאישר הגעה",
    tier: "draft",
    platform: "both",
    api: "events.get → attendees[] → drafts.create",
    scope: "calendar.readonly + gmail.compose",
    caveat: "הנמענים הם מי שאישר את ההזמנה — לא מי שנכח בפועל.",
  },
  {
    id: "propose-event",
    he: "הצעת פגישה חדשה לפני שליחה",
    tier: "draft",
    platform: "both",
    api: "מוחזק בצד הלקוח עד אישור",
    scope: "—",
    caveat: "ל-Calendar API אין מצב טיוטה לאירוע, לכן ההצעה נשמרת מקומית עד שתאשר.",
  },
  {
    id: "send-mail",
    he: "שליחת המייל",
    tier: "send",
    platform: "both",
    api: "Gmail messages.send · Graph /me/sendMail",
    scope: "gmail.send · Mail.Send",
    caveat: "אין ביטול אחרי שליחה.",
  },
  {
    id: "create-event",
    he: "יצירת פגישה ושליחת הזמנות",
    tier: "send",
    platform: "both",
    api: "events.insert?sendUpdates=all · Graph POST /me/events",
    scope: "calendar.events · Calendars.ReadWrite",
    caveat: "מודיע לכל המוזמנים.",
  },
  {
    id: "update-event",
    he: "עדכון או ביטול פגישה קיימת",
    tier: "send",
    platform: "both",
    api: "events.patch / events.delete · Graph PATCH|DELETE /me/events/{id}",
    scope: "calendar.events · Calendars.ReadWrite",
    caveat: "מודיע לכל המוזמנים.",
  },
];

export const TIER_LABEL: Record<Tier, string> = {
  read: "קריאה",
  draft: "טיוטה",
  send: "שליחה",
};
