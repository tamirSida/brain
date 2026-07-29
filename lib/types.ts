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

export interface SessionState {
  email: string;
  profile: Profile;
  brief: Brief;
  /** Where the brief came from — surfaced in the UI so canned data is never mistaken for a live model response. */
  source: "model" | "demo";
  createdAt: string;
  updatedAt: string;
}

export type ConnectorStatus = "live" | "syncing" | "error" | "unconfigured";

export interface Connector {
  id: string;
  name: string;
  nameHe: string;
  logo: string;
  /** Some supplied brand assets are white-on-dark; those need a dark chip. */
  chip: "light" | "dark";
  kind: string;
  status: ConnectorStatus;
  /** Indexed object count; null when not configured. */
  objects: number | null;
  lastSync: string | null;
}
