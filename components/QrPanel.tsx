"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { faMobileScreenButton, faXmark } from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

/**
 * The phone handoff.
 *
 * The QR is generated in the browser from `window.location.origin`, not on the
 * server: during a demo the dashboard is reached through an ngrok tunnel, and
 * the server has no idea what public hostname it is being proxied under. The
 * origin the operator is actually looking at is the only reliable source.
 */
/** Origins a phone on another network can never reach. */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$)/;

/** Configured tunnel, trimmed of a trailing slash so paths don't double up. */
const TUNNEL = (process.env.NEXT_PUBLIC_TUNNEL_URL ?? "").trim().replace(/\/+$/, "");

export function QrPanel({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [tunnelled, setTunnelled] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Resolved after mount, not during render: the server has no window, and
    // behind a tunnel only the browser knows the public origin.
    //
    // When the dashboard is being viewed on localhost the origin is useless to
    // a phone, so fall back to the configured tunnel. Viewed through the
    // tunnel already, the origin is correct and wins.
    const here = window.location.origin;
    const useTunnel = LOCAL.test(here) && TUNNEL.length > 0;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTunnelled(useTunnel);
    setUrl(`${useTunnel ? TUNNEL : here}/r/${boardId}`);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [boardId]);

  useEffect(() => {
    if (!open || !url || !canvas.current) return;
    void QRCode.toCanvas(canvas.current, url, {
      width: 220,
      margin: 1,
      // Fixed black-on-white: a themed QR is a QR that sometimes doesn't scan.
      color: { dark: "#0d131b", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const unreachable = url !== null && LOCAL.test(url);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="פתח את הלוח בטלפון"
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12.5px] transition-colors",
          open
            ? "border-brand/60 bg-brand/8 text-ink"
            : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
        )}
      >
        <Icon icon={faMobileScreenButton} className="text-[12px]" />
        ערוך מהטלפון
      </button>

      {open && (
        <>
          {/* Click-away. Transparent: the dashboard behind stays readable,
              which matters when this is on screen in front of a room. */}
          <button
            type="button"
            aria-label="סגור"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            role="dialog"
            aria-label="סריקה לפתיחה בטלפון"
            className="rise absolute top-full z-50 mt-2 w-[268px] rounded-[var(--radius-card)] border border-line bg-bg p-4 shadow-2xl start-0"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13.5px] font-medium text-ink">סרוק כדי לערוך</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Icon icon={faXmark} className="text-[13px]" />
              </button>
            </div>

            <div className="mt-3 grid place-items-center rounded-[10px] bg-white p-3">
              <canvas ref={canvas} className="block" />
            </div>

            {/* The destination, spelled out. During a demo this is the one
                thing worth being able to confirm without scanning: whether the
                phone is about to be sent to the live site or to a tunnel. */}
            <p className="mt-3 break-all text-center text-[11px] text-ink-3">
              <span className="num text-ink-2" dir="ltr">
                {url ? `${new URL(url).host}/r/${boardId}` : `/r/${boardId}`}
              </span>
            </p>

            {tunnelled && (
              <p className="mt-2 text-center text-[10.5px] leading-relaxed text-ink-3">
                דרך מנהרת ngrok — כי המסך פתוח מקומית
              </p>
            )}

            {unreachable && (
              // A localhost QR scans fine and then fails on the phone. Say so
              // here rather than letting it fail in front of an audience.
              <p className="mt-2 rounded-[8px] bg-warn/10 px-2.5 py-2 text-[11px] leading-relaxed text-warn">
                הכתובת מקומית — טלפון לא יגיע אליה. הגדר NEXT_PUBLIC_TUNNEL_URL
                או פתח את המסך דרך המנהרה.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
