import "server-only";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "@/lib/firebase/config";
import type { SessionState } from "@/lib/types";

/**
 * Session store keyed by email. No auth in the mock — email is the session key.
 *
 * Uses the Firebase *web* SDK (no service account). This config is public by
 * design; access is governed by Firestore security rules, not by hiding it.
 *
 * NOTE: the `brain_sessions` collection must be readable/writable by
 * unauthenticated clients for the mock to persist. Rules:
 *
 *   match /brain_sessions/{id} { allow read, write: if true; }
 *
 * Falls back to an in-memory store if Firestore is unreachable, so the mock
 * never hard-fails during a demo.
 */


const COLLECTION = process.env.NEXT_PUBLIC_FIRESTORE_COLLECTION ?? "brain_sessions";
/** boardId → email, so the phone remote can find a session it never logged into. */
const BOARDS = "brain_boards";

let db: Firestore | null = null;

export function firestore(): Firestore {
  if (db) return db;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

/**
 * In-memory fallback. Hung off globalThis: Next re-evaluates modules between
 * requests in dev, so a plain module-level Map silently loses every write.
 */
const globalForStore = globalThis as typeof globalThis & {
  __ofekBrainStore?: Map<string, SessionState>;
  __ofekBrainBoards?: Map<string, string>;
};
const memory = (globalForStore.__ofekBrainStore ??= new Map<string, SessionState>());
const boardMemory = (globalForStore.__ofekBrainBoards ??= new Map<string, string>());

const key = (email: string) => email.trim().toLowerCase();

/** Firestore rejects undefined — strip it before every write. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function readSession(email: string): Promise<SessionState | null> {
  const id = key(email);
  try {
    const snap = await getDoc(doc(firestore(), COLLECTION, id));
    if (snap.exists()) return snap.data() as SessionState;
    return memory.get(id) ?? null;
  } catch (err) {
    console.warn("[store] Firestore read failed, using memory:", (err as Error).message);
    return memory.get(id) ?? null;
  }
}

export async function writeSession(state: SessionState): Promise<void> {
  const id = key(state.email);
  const payload = clean(state);
  memory.set(id, payload);
  try {
    await setDoc(doc(firestore(), COLLECTION, id), payload, { merge: true });
  } catch (err) {
    console.warn("[store] Firestore write failed, kept in memory:", (err as Error).message);
  }
}

/**
 * Drop a session entirely, so a fresh onboarding rebuilds from a clean slate
 * instead of merging onto stale fields (writeSession uses merge: true). The
 * board-link doc is left as-is: it is keyed by a random board id nobody else
 * holds, and readBoard resolves a dangling link to null on its own.
 */
export async function deleteSession(email: string): Promise<void> {
  const id = key(email);
  memory.delete(id);
  try {
    await deleteDoc(doc(firestore(), COLLECTION, id));
  } catch (err) {
    console.warn("[store] Firestore delete failed:", (err as Error).message);
  }
}

/** Short, unambiguous board id — no vowels or lookalike characters, since it
 *  ends up in a URL that people read off a screen when the camera misfires. */
export function newBoardId(): string {
  const alphabet = "23456789bcdfghjkmnpqrstvwxz";
  let out = "";
  for (let i = 0; i < 7; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function linkBoard(boardId: string, email: string): Promise<void> {
  boardMemory.set(boardId, key(email));
  try {
    await setDoc(doc(firestore(), BOARDS, boardId), { email: key(email) });
  } catch (err) {
    console.warn("[store] board link failed, kept in memory:", (err as Error).message);
  }
}

/** Resolve a board id back to its session. Returns null for an unknown board. */
export async function readBoard(boardId: string): Promise<SessionState | null> {
  let email = boardMemory.get(boardId) ?? null;
  if (!email) {
    try {
      const snap = await getDoc(doc(firestore(), BOARDS, boardId));
      if (snap.exists()) {
        email = (snap.data() as { email?: string }).email ?? null;
        if (email) boardMemory.set(boardId, email);
      }
    } catch (err) {
      console.warn("[store] board read failed:", (err as Error).message);
    }
  }
  return email ? readSession(email) : null;
}
