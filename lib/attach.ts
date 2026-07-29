/**
 * File attachments for the composer.
 *
 * Text-like files are read in the browser and their contents travel with the
 * message, so the model can actually answer about them. Anything else is
 * attached by reference — name, type and size — and the model is told plainly
 * that it has the metadata and not the bytes. That distinction matters: a mock
 * that silently pretends to have read a PDF is worse than one that says so.
 */

export interface Attachment {
  name: string;
  size: number;
  type: string;
  /** Present only for files we could actually decode as text. */
  text?: string;
}

/** Extensions worth reading even when the browser reports no useful MIME type. */
const TEXTUAL = /\.(txt|md|csv|tsv|json|ya?ml|log|html?|xml|ts|tsx|js|jsx|css|sql)$/i;

/** Cap on inlined content — enough for a real document, short of a runaway. */
const MAX_CHARS = 40_000;

export const MAX_BYTES = 5 * 1024 * 1024;

export function isTextual(file: File): boolean {
  return file.type.startsWith("text/") || TEXTUAL.test(file.name) || file.type === "application/json";
}

export async function readAttachment(file: File): Promise<Attachment> {
  const base = { name: file.name, size: file.size, type: file.type || "לא ידוע" };
  if (!isTextual(file)) return base;

  const raw = await file.text();
  return {
    ...base,
    text: raw.length > MAX_CHARS ? `${raw.slice(0, MAX_CHARS)}\n…(נחתך)` : raw,
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Fold an attachment into the outgoing message text. */
export function withAttachment(text: string, att: Attachment | null): string {
  if (!att) return text;

  const head = `[קובץ מצורף: ${att.name} · ${att.type} · ${formatSize(att.size)}]`;
  const body = att.text
    ? `\n<תוכן הקובץ>\n${att.text}\n</תוכן הקובץ>`
    : `\n(לא ניתן לקרוא את תוכן הקובץ הזה בדפדפן — יש לך רק שם הקובץ והסוג שלו.)`;

  return `${head}${body}\n\n${text}`.trim();
}
