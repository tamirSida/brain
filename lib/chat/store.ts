import "server-only";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/store";
import type { Conversation, ConversationMeta } from "./types";

const COLLECTION = "brain_conversations";

/** Mirrors lib/store.ts — survives Next's dev-mode module re-evaluation. */
const globalForChat = globalThis as typeof globalThis & {
  __lightstoneChats?: Map<string, Conversation>;
};
const memory = (globalForChat.__lightstoneChats ??= new Map<string, Conversation>());

function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function readConversation(id: string): Promise<Conversation | null> {
  try {
    const snap = await getDoc(doc(firestore(), COLLECTION, id));
    if (snap.exists()) return snap.data() as Conversation;
  } catch (err) {
    console.warn("[chat] read failed, using memory:", (err as Error).message);
  }
  return memory.get(id) ?? null;
}

export async function writeConversation(convo: Conversation): Promise<void> {
  const payload = clean(convo);
  memory.set(convo.id, payload);
  try {
    await setDoc(doc(firestore(), COLLECTION, convo.id), payload, { merge: true });
  } catch (err) {
    console.warn("[chat] write failed, kept in memory:", (err as Error).message);
  }
}

export async function listConversations(email: string): Promise<ConversationMeta[]> {
  const key = email.trim().toLowerCase();
  const fromMemory = (): ConversationMeta[] =>
    [...memory.values()]
      .filter((c) => c.email === key)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toMeta);

  try {
    const q = query(
      collection(firestore(), COLLECTION),
      where("email", "==", key),
      orderBy("updatedAt", "desc"),
      fsLimit(30)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs.map((d) => toMeta(d.data() as Conversation));
  } catch (err) {
    // A missing composite index surfaces here — fall back rather than 500.
    console.warn("[chat] list failed, using memory:", (err as Error).message);
  }
  return fromMemory();
}

function toMeta(c: Conversation): ConversationMeta {
  return {
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
  };
}
