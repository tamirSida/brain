export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  ts: string;
  /** Real token usage reported by the API for the turn that produced this. */
  tokens?: { input: number; output: number; cacheRead: number };
  /** Set when the message was dictated rather than typed. */
  voice?: boolean;
}

export interface Conversation {
  id: string;
  email: string;
  title: string;
  messages: ChatMessage[];
  /**
   * Rolling summary of everything before `summarizedUpTo`. Older turns are
   * folded into this instead of being resent verbatim on every request.
   */
  summary: string | null;
  summarizedUpTo: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}
