"use client";

import { LightstoneLogo, LightstoneMark } from "@/components/brand/Lightstone";
import { cn } from "@/lib/cn";
import { useThinking } from "@/lib/thinking";

/**
 * The brand marks, wired to the app's state.
 *
 * Lightstone owns a single red and a letterform, so the thinking state cannot
 * be a colour change across parts the way a multi-coloured mark allows. It is
 * carried instead by an arc that orbits the mark: the identity stays still and
 * legible, and the motion sits beside it rather than being applied to it.
 * Using the mark as the loading indicator still means one fewer invented
 * visual language on the screen.
 */

/** The mark. An arc orbits it whenever anything is thinking. */
export function BrandMark({
  className,
  /** Force the orbiting arc regardless of the global thinking state. */
  busy = false,
  /** Tint the mark on hover — needs `group` on an ancestor. */
  hover = false,
}: {
  className?: string;
  busy?: boolean;
  hover?: boolean;
}) {
  const thinking = useThinking();
  const active = busy || thinking;

  return (
    <LightstoneMark
      className={cn(
        active && "is-thinking",
        // Hover tint is CSS-only, so it costs nothing when unused.
        hover && "group-hover:text-[#D01E3B]",
        className
      )}
    />
  );
}

/**
 * The wordmark. Always the brand red, and it never moves.
 *
 * Not `currentColor` like the mark: Lightstone's wordmark is red everywhere it
 * appears, and rendering it in the page's ink would be showing someone a
 * recoloured version of their own logo. It breathes while thinking, which is
 * the most a wordmark can do without becoming unreadable.
 */
export function BrandLogo({ className }: { className?: string }) {
  const thinking = useThinking();

  return <LightstoneLogo className={cn("is-brand", thinking && "is-thinking", className)} />;
}
