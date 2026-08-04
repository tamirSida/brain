import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Minimal Markdown renderer for model output.
 *
 * Deliberately builds React nodes rather than using dangerouslySetInnerHTML —
 * this text comes from an LLM, so it must never be able to inject markup.
 *
 * Supports the subset the model actually produces: headings, bold, italic,
 * inline code, bullet and numbered lists, and paragraphs. Anything else falls
 * through as plain text rather than showing raw syntax.
 */

/** Inline: **bold**, *italic*, `code`. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Split on the three inline forms, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|(?<!\*)\*(?!\*)[^*]+\*(?!\*)|`[^`]+`)/g);

  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(
        <strong key={key} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      out.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      out.push(
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    } else {
      out.push(<Fragment key={key}>{part}</Fragment>);
    }
  });

  return out;
}

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; lines: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const last = blocks[blocks.length - 1];

    if (!trimmed) continue;

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: heading[2] });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      if (last?.type === "ol") last.items.push(numbered[1]);
      else blocks.push({ type: "ol", items: [numbered[1]] });
      continue;
    }

    if (last?.type === "p") last.lines.push(trimmed);
    else blocks.push({ type: "p", lines: [trimmed] });
  }

  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text);

  return (
    <div className={cn("space-y-2.5 leading-relaxed", className)}>
      {blocks.map((b, i) => {
        const key = `b-${i}`;
        if (b.type === "h") {
          return (
            <p
              key={key}
              className={cn(
                "font-medium text-ink",
                b.level <= 2 ? "text-[1.05em]" : "text-[1em]",
                i > 0 && "pt-1"
              )}
            >
              {inline(b.text, key)}
            </p>
          );
        }
        if (b.type === "ul") {
          return (
            // ps-/marker follow the inline-start edge automatically.
            <ul key={key} className="list-disc space-y-1 ps-5 marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={`${key}-${j}`}>{inline(it, `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={key} className="list-decimal space-y-1 ps-5 marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={`${key}-${j}`}>{inline(it, `${key}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={key}>
            {b.lines.map((ln, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 && <br />}
                {inline(ln, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
