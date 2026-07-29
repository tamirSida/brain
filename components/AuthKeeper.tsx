"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/http";

/**
 * Keeps the server cookie in step with the Firebase session.
 *
 * ID tokens last an hour. The SDK refreshes them on its own using the stored
 * refresh token and fires `onIdTokenChanged` each time — mirroring that into
 * the cookie is what stops a demo dropping to the login screen mid-sentence.
 * Renders nothing.
 */
export function AuthKeeper() {
  useEffect(() => {
    return onIdTokenChanged(firebaseAuth(), async (user) => {
      // Signed out is handled by the sign-out action itself; doing it here too
      // would race with it during navigation.
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        await apiFetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        // A failed refresh isn't worth interrupting anyone over; the proxy
        // will send them to /login when the current cookie finally expires.
      }
    });
  }, []);

  return null;
}
