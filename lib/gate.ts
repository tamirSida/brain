/**
 * The demo gate: one shared password in front of the whole prototype.
 *
 * This is access control for the *site*, not identity. It deliberately knows
 * nothing about sessions, profiles or boards — passing the gate only means you
 * are allowed to reach onboarding, and everything after it works exactly as
 * before. Nothing here is stored per visitor.
 *
 * Unset `DEMO_PASSWORD` and the gate disappears entirely, which keeps local
 * development frictionless and means a missing variable fails open rather than
 * locking everyone out of a live demo.
 */

export const GATE_COOKIE = "ofek_gate";

/** Query parameter that carries the token, so a scanned QR grants access. */
export const GATE_PARAM = "k";

/** A month: long enough that nobody re-enters it mid-demo. */
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * The cookie value for the configured password — its SHA-256, so the password
 * itself never sits in a cookie or a QR code.
 *
 * Returns null when no password is set, which means the gate is off.
 * Web Crypto rather than node:crypto: this has to run in the proxy too.
 */
export async function gateToken(): Promise<string | null> {
  const secret = process.env.DEMO_PASSWORD?.trim();
  if (!secret) return null;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent comparison, so the token can't be probed byte by byte. */
export function tokensMatch(a: string | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
