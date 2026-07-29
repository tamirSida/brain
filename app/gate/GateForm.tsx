"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { faArrowLeft, faCircleNotch, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";

export function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only ever an internal path: an open redirect would let this page bounce a
  // visitor anywhere, and it is the one URL a stranger is guaranteed to reach.
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "הכניסה נכשלה");
      router.replace(next);
      // The destination is server-rendered behind the gate, so it has to be
      // re-fetched now that the cookie exists.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="rise relative w-full max-w-[380px]">
      <div className="flex flex-col items-center">
        <Image
          src="/ofek-logo.svg"
          alt="אופק אחזקות"
          width={96}
          height={34}
          priority
          className="brand-mark opacity-90"
        />
        <p className="mt-4 text-[15px] text-ink-2">המוח הארגוני</p>
      </div>

      <form onSubmit={submit} className="notif mt-8 p-5">
        <label htmlFor="gate-password" className="block text-[14px] font-medium text-ink">
          סיסמת גישה
        </label>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          אב-טיפוס להדגמה. כל הנתונים בו בדיוניים.
        </p>

        <input
          id="gate-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-4 min-h-12 w-full rounded-[var(--radius-ctl)] border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand/70 focus:outline-none disabled:opacity-60"
          placeholder="הזן סיסמה"
        />

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-risk">
            <Icon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password.trim()}
          className={cn(
            "mt-5 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-ctl)] text-[15px] font-medium transition-colors",
            busy || !password.trim()
              ? "cursor-not-allowed bg-surface-2 text-ink-3"
              : "bg-brand text-brand-on hover:bg-brand-hi"
          )}
        >
          {busy && <Icon icon={faCircleNotch} className="animate-spin text-[13px]" />}
          {busy ? "בודק…" : "כניסה"}
          {!busy && <Icon icon={faArrowLeft} className="text-[13px]" />}
        </button>
      </form>
    </div>
  );
}
