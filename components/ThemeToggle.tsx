"use client";

import { useEffect, useState } from "react";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/Icon";

type Theme = "light" | "dark";

/**
 * Theme switch. Writes data-theme on <html> and persists the choice.
 * With no stored choice the app follows prefers-color-scheme (see globals.css),
 * so this only ever sets an explicit override.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Intentional: the server can't know the viewer's preference, so the
    // control must resolve after mount. Hydration-safe pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = document.documentElement.dataset.theme as Theme | undefined;
    if (stored) {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ofek-theme", next);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "עבור למצב כהה" : "עבור למצב בהיר"}
      className="grid size-11 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      {/* Render nothing until mounted — the server can't know the preference. */}
      {theme && <Icon icon={isLight ? faMoon : faSun} className="text-[14px]" />}
    </button>
  );
}
