"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut as firebaseSignOut } from "firebase/auth";
import { faArrowRightFromBracket, faCircleNotch } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { firebaseAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";

/**
 * Sign out of all three places it is possible to still be signed in: the
 * Firebase session in the browser, the verified cookie the server reads, and
 * the email that keys the dashboard. Leaving any one behind means the next
 * visitor lands somewhere they shouldn't.
 */
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      // Firebase first: it holds the refresh token, and while it lives the
      // keeper would happily mint a new cookie straight after we cleared it.
      await firebaseSignOut(firebaseAuth()).catch(() => {});
      await apiFetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      await apiFetch("/api/session", { method: "DELETE" }).catch(() => {});
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[12px]",
        "text-ink-2 transition-colors hover:border-line-strong"
      )}
    >
      <Icon
        icon={busy ? faCircleNotch : faArrowRightFromBracket}
        className={cn("text-[10px]", busy && "animate-spin")}
      />
      Sign out
    </button>
  );
}
