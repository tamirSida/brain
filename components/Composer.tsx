"use client";

import { useRef, useState } from "react";
import {
  faArrowUp,
  faCircleNotch,
  faFileLines,
  faMicrophone,
  faPlus,
  faStop,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  MAX_BYTES,
  formatSize,
  readAttachment,
  type Attachment,
} from "@/lib/attach";

/**
 * The single message composer, shared by the chat page and the dashboard.
 *
 * One pill: attach, type, dictate, send. Both surfaces use this so the input
 * can't drift apart between them.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  busy = false,
  listening = false,
  onMic,
  placeholder,
  multiline = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Receives the typed text plus whatever is attached. */
  onSubmit: (text: string, attachment: Attachment | null) => void;
  busy?: boolean;
  listening?: boolean;
  onMic?: () => void;
  placeholder?: string;
  /** Chat uses a growing textarea; the dashboard bar stays one line. */
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSend = (value.trim().length > 0 || attachment !== null) && !busy && !reading;

  async function pick(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_BYTES) {
      setFileError(`הקובץ גדול מ-${formatSize(MAX_BYTES)}`);
      return;
    }
    setReading(true);
    try {
      setAttachment(await readAttachment(file));
    } catch {
      setFileError("קריאת הקובץ נכשלה");
    } finally {
      setReading(false);
    }
  }

  function submit() {
    if (!canSend) return;
    onSubmit(value, attachment);
    setAttachment(null);
  }

  return (
    <div>
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink-2">
          <Icon icon={faFileLines} className="shrink-0 text-[11px] text-ink-3" />
          <span className="truncate">{attachment.name}</span>
          <span className="num shrink-0 text-[11px] text-ink-3">{formatSize(attachment.size)}</span>
          {!attachment.text && (
            // Say so rather than letting the model be asked to read bytes it
            // was never given.
            <span className="shrink-0 rounded-full bg-bg-2 px-1.5 text-[10.5px] text-ink-3">
              שם בלבד
            </span>
          )}
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="הסר קובץ"
            className="ms-auto grid size-6 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
          >
            <Icon icon={faXmark} className="text-[11px]" />
          </button>
        </div>
      )}

      {fileError && (
        <p role="alert" className="mb-2 px-3 text-[12px] text-risk">
          {fileError}
        </p>
      )}

      {/* One pill holds every control, so the row reads as a single field. */}
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border bg-surface p-1.5 transition-colors",
          listening ? "border-risk/60" : "border-line focus-within:border-brand/70"
        )}
      >
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            // Reset so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={reading}
          aria-label="צרף קובץ"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Icon icon={reading ? faCircleNotch : faPlus} className={cn("text-[15px]", reading && "animate-spin")} />
        </button>

        {multiline ? (
          <textarea
            rows={1}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={listening ? "מקשיב…" : placeholder}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
        ) : (
          <input
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={listening ? "מקשיב…" : placeholder}
            className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-[14.5px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
        )}

        {onMic && (
          <button
            type="button"
            onClick={onMic}
            aria-label={listening ? "עצור הכתבה" : "הכתבה קולית"}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
              listening ? "bg-risk/10 text-risk" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Icon icon={listening ? faStop : faMicrophone} className="text-[15px]" />
          </button>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="שלח"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            canSend ? "bg-brand text-brand-on hover:bg-brand-hi" : "cursor-not-allowed bg-surface-2 text-ink-3"
          )}
        >
          <Icon icon={busy ? faCircleNotch : faArrowUp} className={cn("text-[15px]", busy && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}
