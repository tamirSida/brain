"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { faArrowRight, faCircleNotch, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

import { BrandLogo } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { firebaseAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";

/** Firebase's error codes, said plainly and without leaking which part was wrong. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email or password is incorrect.",
  "auth/invalid-email": "That email address is not valid.",
  "auth/user-disabled": "That account is disabled.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "No network connection.",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only ever an internal path: an open redirect would let the one page every
  // stranger reaches bounce them anywhere.
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      const idToken = await cred.user.getIdToken();

      // The server decides on its own evidence: it verifies this token rather
      // than trusting that the client says sign-in worked.
      const res = await apiFetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Sign-in failed");
      }

      router.replace(next);
      // The destination is rendered on the server behind the proxy, so it has
      // to be re-fetched now that the cookie exists.
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        (code && MESSAGES[code]) ||
          (err instanceof Error ? err.message : "Unexpected error")
      );
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="rise relative w-full max-w-[380px]">
      <div className="flex flex-col items-center">
        <span className="group inline-flex text-ink">
          <BrandLogo className="h-9 w-auto" />
        </span>
        <p className="mt-4 text-[15px] text-ink-2">Organization Brain</p>
      </div>

      <form onSubmit={submit} className="notif mt-8 p-5" noValidate>
        <h1 className="text-[15px] font-medium text-ink">Sign in</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          A demo prototype. Every figure in it is fictional.
        </p>

        <label htmlFor="email" className="mt-4 block text-[13px] text-ink-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          dir="ltr"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="mt-1.5 min-h-12 w-full rounded-[var(--radius-ctl)] border border-line bg-surface px-4 text-start text-[15px] text-ink placeholder:text-ink-3 focus:border-brand/70 focus:outline-none disabled:opacity-60"
          placeholder="name@lightstonegroup.com"
        />

        <label htmlFor="password" className="mt-3 block text-[13px] text-ink-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-1.5 min-h-12 w-full rounded-[var(--radius-ctl)] border border-line bg-surface px-4 text-[15px] text-ink focus:border-brand/70 focus:outline-none disabled:opacity-60"
        />

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-risk">
            <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className={cn(
            "mt-5 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-ctl)] text-[15px] font-medium transition-colors",
            busy || !email.trim() || !password
              ? "cursor-not-allowed bg-surface-2 text-ink-3"
              : "bg-brand text-brand-on hover:bg-brand-hi"
          )}
        >
          {busy && <Icon icon={faCircleNotch} className="animate-spin text-[13px]" />}
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <Icon icon={faArrowRight} className="text-[13px]" />}
        </button>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-3">
          Users are managed in Firebase Authentication.
        </p>
      </form>
    </div>
  );
}
