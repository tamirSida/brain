"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  faArrowLeft,
  faCircleNotch,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

type Values = { name: string; email: string; title: string; focus: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STAGES = [
  "קורא את מה שכתבת",
  "בוחר את שלושת המדדים",
  "מרכיב את מסך הבית",
];

export function OnboardingForm() {
  const router = useRouter();
  const [v, setV] = useState<Values>({ name: "", email: "", title: "", focus: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Progressive reveal — each field appears once the previous one is answered.
  const showEmail = v.name.trim().length >= 2;
  const showTitle = showEmail && EMAIL_RE.test(v.email.trim());
  const showFocus = showTitle && v.title.trim().length >= 2;
  const ready = showFocus && v.focus.trim().length >= 12;

  const emailInvalid = touched.email && v.email.trim() !== "" && !EMAIL_RE.test(v.email.trim());

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2600);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setStage(0);
    setError(null);
    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "לא הצלחנו לבנות את המסך. נסה שוב.");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה.");
      setBusy(false);
    }
  }

  if (busy) return <Building stage={stage} />;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="מה השם שלך?" htmlFor="name" show>
        <input
          id="name"
          autoFocus
          autoComplete="name"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          placeholder="שם מלא"
          className={inputCls}
        />
      </Field>

      <Field label="לאן לשלוח את העדכונים?" htmlFor="email" show={showEmail}>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={v.email}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          onChange={(e) => setV({ ...v, email: e.target.value })}
          placeholder="name@ofek-holdings.com"
          aria-invalid={emailInvalid || undefined}
          aria-describedby={emailInvalid ? "email-err" : undefined}
          className={cn(inputCls, "text-left", emailInvalid && "border-risk/60")}
        />
        {emailInvalid && (
          <p id="email-err" className="mt-1.5 text-[12.5px] text-risk">
            כתובת הדוא״ל אינה תקינה
          </p>
        )}
      </Field>

      <Field label="מה התפקיד שלך?" htmlFor="title" show={showTitle}>
        <input
          id="title"
          autoComplete="organization-title"
          value={v.title}
          onChange={(e) => setV({ ...v, title: e.target.value })}
          placeholder="למשל: סמנכ״ל כספים"
          className={inputCls}
        />
      </Field>

      <Field
        label="מה שלושת המספרים שחשוב לראות כל בוקר?"
        htmlFor="focus"
        show={showFocus}
        help="אפשר לכתוב בשפה חופשית. אין צורך בפורמט מסוים."
      >
        <textarea
          id="focus"
          rows={4}
          value={v.focus}
          onChange={(e) => setV({ ...v, focus: e.target.value })}
          placeholder="למשל: תזרים מזומנים חודשי, חריגות תקציב בפרויקטים הפעילים, ואחוזי אכלוס בנכסים המניבים"
          className={cn(inputCls, "resize-none leading-relaxed")}
        />
        <p className="mt-1.5 text-[12px] text-ink-3">
          <span className="num">{v.focus.trim().length}</span> תווים
          {v.focus.trim().length < 12 && " · עוד קצת פירוט יעזור"}
        </p>
      </Field>

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-ctl)] border border-risk/40 bg-risk/8 p-3 text-[13px] text-risk"
        >
          <Icon icon={faTriangleExclamation} className="mt-0.5" />
          {error}
        </p>
      )}

      {/* The CTA appears only once every field is revealed, so it doesn't
          shuffle down the page on each keystroke.

          Deliberately NOT auto-focusing newly revealed fields: the reveal is
          triggered mid-keystroke, so moving focus would yank the caret out of
          the field the user is still typing in. */}
      {showFocus && (
        <button
          type="submit"
          disabled={!ready}
          className={cn(
            "rise flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-ctl)] px-5 py-3.5",
            "text-[15px] font-medium transition-colors duration-200",
            ready
              ? "bg-brand text-white hover:bg-brand-hi"
              : "cursor-not-allowed bg-surface-2 text-ink-3"
          )}
        >
          בנה את המוח שלי
          <Icon icon={faArrowLeft} className="text-[13px]" />
        </button>
      )}
    </form>
  );
}

const inputCls = cn(
  "w-full rounded-[var(--radius-ctl)] border border-line bg-surface/70 px-4 py-3.5",
  "text-[15px] text-ink placeholder:text-ink-3",
  "transition-colors duration-200 focus:border-brand/70 focus:outline-none"
);

function Field({
  label,
  htmlFor,
  show,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  show: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="rise">
      <label htmlFor={htmlFor} className="mb-2 block text-[14px] font-medium text-ink">
        {label}
      </label>
      {help && <p className="mb-2 -mt-1 text-[12.5px] text-ink-3">{help}</p>}
      {children}
    </div>
  );
}

function Building({ stage }: { stage: number }) {
  return (
    <div className="py-6" role="status" aria-live="polite">
      <div className="relative mx-auto grid size-28 place-items-center">
        <span className="absolute inset-0 rounded-full border border-brand/25 pulse" />
        <span className="absolute inset-4 rounded-full border border-brand/40" />
        <Icon icon={faCircleNotch} className="animate-spin text-[22px] text-brand-hi" />
      </div>

      <ol className="mx-auto mt-8 max-w-xs space-y-3">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-3 text-[14px] transition-opacity duration-500",
              i <= stage ? "text-ink opacity-100" : "text-ink-3 opacity-45"
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                i < stage ? "bg-ok" : i === stage ? "bg-brand-hi pulse" : "bg-line-strong"
              )}
            />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
