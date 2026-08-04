import "server-only";

import { cookies } from "next/headers";

const COOKIE = "almogim_brain_email";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Next 16: cookies() is async. Synchronous access was removed. */
export async function currentEmail(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  // The @ in an address round-trips as %40 through some clients — decode it.
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function setCurrentEmail(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, email.trim().toLowerCase(), {
    path: "/",
    maxAge: MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearCurrentEmail(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
