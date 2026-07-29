"use client";

import { useEffect, useState } from "react";
import { faCloudMoon, faCloudSun, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { Icon } from "@/components/Icon";

/**
 * Time-of-day greeting computed from the viewer's clock.
 *
 * The server can't know the viewer's local hour, and the stored brief was
 * generated once at onboarding — so its salutation would freeze at whatever
 * time the user signed up ("ערב טוב" at 13:42). Resolve it live instead.
 */

/** Each part of the day gets its own words, icon and light — the header should
 *  feel different at 07:00 and at 23:00, not just say a different noun. */
interface TimeOfDay {
  hello: string;
  icon: IconDefinition;
  /** Tailwind classes for the icon's colour and its halo. */
  tint: string;
  glow: string;
}

const NIGHT: TimeOfDay = {
  hello: "לילה טוב",
  icon: faMoon,
  tint: "text-[#8ea2c4]",
  glow: "bg-[#8ea2c4]/12",
};

function timeOfDay(h: number): TimeOfDay {
  if (h < 5) return NIGHT;
  if (h < 12)
    return { hello: "בוקר טוב", icon: faSun, tint: "text-[#e0a340]", glow: "bg-[#e0a340]/14" };
  if (h < 17)
    return { hello: "צהריים טובים", icon: faCloudSun, tint: "text-[#d99a4e]", glow: "bg-[#d99a4e]/14" };
  if (h < 21)
    return { hello: "ערב טוב", icon: faCloudMoon, tint: "text-[#a08bc4]", glow: "bg-[#a08bc4]/14" };
  return NIGHT;
}

export function Greeting({ firstName }: { firstName: string }) {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHour(new Date().getHours());
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  const t = hour === null ? null : timeOfDay(hour);

  // Reserve the row's height before `hour` resolves so nothing below it jumps.
  return (
    <div className="flex min-h-10 items-center justify-center gap-3">
      {t && (
        <>
          <span className={`grid size-9 place-items-center rounded-full ${t.glow} ${t.tint}`}>
            <Icon icon={t.icon} className="text-[15px]" />
          </span>
          <p className="text-[19px] text-ink-2 sm:text-[21px]">
            {t.hello}
            {firstName && <span className="text-ink">, {firstName}</span>}
          </p>
        </>
      )}
    </div>
  );
}
