import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/cn";

/**
 * Renders a Font Awesome icon as inline SVG with zero client JS.
 * Never emoji — emoji are font-dependent and can't be themed.
 *
 * Decorative by default (aria-hidden). Pass `label` for a meaningful icon.
 */
export function Icon({
  icon,
  className,
  label,
}: {
  icon: IconDefinition;
  className?: string;
  label?: string;
}) {
  const [w, h, , , path] = icon.icon;
  const d = Array.isArray(path) ? path.join(" ") : path;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("inline-block size-[1em] shrink-0 fill-current", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
