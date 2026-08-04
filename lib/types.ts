import type { Brief } from "@/lib/ai/schemas";
import type { LayoutId } from "@/lib/layouts";

export interface Profile {
  name: string;
  email: string;
  title: string;
  /** Free-text: which three metrics they care about. */
  focus: string;
  /** How the three metrics are arranged. Optional: sessions written before
   *  layouts existed fall back to DEFAULT_LAYOUT. */
  layout?: LayoutId;
}

export interface PhoneTurn {
  /** Stable across the two writes — the question goes up before the model runs,
   *  and the answer is patched onto the same entry when it lands. */
  id: string;
  question: string;
  answer?: string;
  at: string;
}

export interface SessionState {
  email: string;
  /** Short public id for this dashboard. The phone remote addresses the board
   *  by this alone — it carries no auth, which is the point: scanning the QR
   *  is the only credential the demo has or needs. */
  boardId: string;
  profile: Profile;
  brief: Brief;
  /** Where the brief came from — surfaced in the UI so canned data is never mistaken for a live model response. */
  source: "model" | "demo";
  /** Set while a phone command is being processed, so the desktop can show
   *  that an edit is arriving. Cleared when the command finishes. */
  pendingSince?: string | null;
  /** What has been said from the phone, oldest first.
   *
   *  Held on the session rather than pushed to the desktop, because the desktop
   *  is already polling and the phone may be on a different network entirely.
   *  `answer` is absent while a turn is still running, which is what lets the
   *  desktop show the question first and the reply when it lands.
   *
   *  A list rather than one entry so the desktop accumulates the exchange into
   *  a conversation instead of replacing it each time. Capped when written. */
  phoneTurns?: PhoneTurn[];
  createdAt: string;
  updatedAt: string;
}

export type ConnectorStatus = "live" | "syncing" | "error" | "unconfigured";

export interface Connector {
  id: string;
  name: string;
  logo: string;
  /** Some supplied brand assets are white-on-dark; those need a dark chip. */
  chip: "light" | "dark";
  kind: string;
  /** Entity names this system holds, used to ground answers about it. */
  entities: string[];
  status: ConnectorStatus;
  /** Indexed object count; null when not configured. */
  objects: number | null;
  lastSync: string | null;
}
