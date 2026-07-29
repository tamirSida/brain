import { createRemoteJWKSet, jwtVerify } from "jose";

import { PROJECT_ID } from "@/lib/firebase/config";

/**
 * Verifying Firebase ID tokens without a service account.
 *
 * The Admin SDK is the usual way to do this, and it needs a service-account
 * key. It isn't required: Firebase signs ID tokens with rotating RSA keys whose
 * public halves Google publishes, so verification is ordinary JWT verification
 * against a public JWKS. What the Admin SDK would add here is convenience, not
 * capability.
 *
 * jose caches and rotates the key set itself, and runs in the edge runtime,
 * which matters because the proxy needs this on every request.
 */

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export const AUTH_COOKIE = "ofek_id_token";

export interface Identity {
  uid: string;
  email: string | null;
}

/**
 * Returns the identity if the token is genuine, current, and issued for this
 * project — otherwise null. Never throws: a bad token is an expected state,
 * not an exceptional one.
 */
export async function verifyIdToken(token: string | undefined): Promise<Identity | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      // Both must be checked: a token minted for another Firebase project is
      // signed by the very same Google keys and would otherwise pass.
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });

    // `sub` is the Firebase uid. A token without one isn't a user token.
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;

    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    // Expired, tampered with, or signed by a key we don't trust.
    return null;
  }
}
