"use client";

import { AlmogimLogo, AlmogimMark } from "@/components/brand/Almogim";
import { cn } from "@/lib/cn";
import { useThinking } from "@/lib/thinking";

/**
 * The brand marks, wired to the app's state.
 *
 * The six dots already have a second, colourful life on almogim.co.il — this
 * borrows it twice: on hover, and while the brain is working, where the ring
 * also spins. Using the identity as the loading indicator means there is one
 * fewer invented visual language on the screen.
 */

/** The dot ring. Spins in colour whenever anything is thinking. */
export function BrandMark({
  className,
  /** Force the coloured spin regardless of the global thinking state. */
  busy = false,
  /** Colour the dots on hover — needs `group` on an ancestor. */
  hover = false,
}: {
  className?: string;
  busy?: boolean;
  hover?: boolean;
}) {
  const thinking = useThinking();
  const active = busy || thinking;

  return (
    <AlmogimMark
      className={cn(
        active && "is-colour is-spinning",
        // Hover colour is CSS-only, so it costs nothing when unused.
        hover && "group-hover:[&_.dot]:fill-[var(--dot)]",
        className
      )}
    />
  );
}

/** Wordmark and mark. The dots colour on hover; the letters stay as they are. */
export function BrandLogo({
  className,
  hover = true,
}: {
  className?: string;
  hover?: boolean;
}) {
  const thinking = useThinking();

  return (
    <AlmogimLogo
      className={cn(
        // The logo picks up colour while thinking too, but never spins — a
        // rotating wordmark would be unreadable.
        thinking && "is-colour",
        hover && "group-hover:[&_.dot]:fill-[var(--dot)]",
        className
      )}
    />
  );
}
