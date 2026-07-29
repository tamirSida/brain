"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hebrew dictation, with iOS Safari treated as a first-class case.
 *
 * iOS is where this breaks, and it breaks quietly. Three things matter:
 *
 *  1. `interimResults` is patchy on iOS — text can arrive only at the end.
 *     We still ask for it, because a recording with no visible transcript is
 *     worse, and the watchdog below turns a silent recogniser into a real
 *     message instead of a button that looks armed and does nothing.
 *  2. `start()` must be called synchronously inside the tap handler. Anything
 *     awaited first (a permission probe, a fetch) loses the user gesture and
 *     the request is rejected.
 *  3. Recognition needs Settings → General → Keyboard → Enable Dictation.
 *     With it off, Safari reports `service-not-allowed` — which is a settings
 *     problem, not a browser-support problem, and must not be reported as
 *     "your browser doesn't support this".
 *
 * A watchdog covers the worst failure: `start()` resolves, no event ever
 * fires, and the button sits there looking armed. Rather than leave a dead
 * control we surface a real message and let the user type.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const ERRORS: Record<string, string> = {
  "not-allowed": "אין הרשאת מיקרופון. אשר גישה למיקרופון ונסה שוב.",
  "service-not-allowed":
    "ההכתבה כבויה במכשיר. הגדרות ← כללי ← מקלדת ← הפעלת הכתבה, ואז נסה שוב.",
  "no-speech": "לא שמעתי כלום. נסה שוב, קרוב יותר למיקרופון.",
  network: "ההכתבה דורשת חיבור רשת יציב.",
  "audio-capture": "לא נמצא מיקרופון זמין.",
};

function ctor(): any {
  if (typeof window === "undefined") return undefined;
  const W = window as any;
  return W.SpeechRecognition ?? W.webkitSpeechRecognition;
}

export interface Dictation {
  /** False only when the API is genuinely absent. */
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  clearError: () => void;
}

export function useDictation({
  onPartial,
  onFinal,
  continuous = false,
}: {
  /** Live text as it is recognised. May not fire until the end on iOS. */
  onPartial?: (text: string) => void;
  /** The final transcript, once. Empty transcripts are not reported. */
  onFinal: (text: string) => void;
  /**
   * Keep listening through pauses, so the speaker decides when they are done
   * rather than the recogniser cutting them off mid-thought.
   */
  continuous?: boolean;
}): Dictation {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recog = useRef<any>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  // Callbacks live in refs so the recognition handlers always see the current
  // ones without re-creating the recogniser on every render.
  const partialRef = useRef(onPartial);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    partialRef.current = onPartial;
    finalRef.current = onFinal;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(ctor()));
    return () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      try {
        recog.current?.abort?.();
      } catch {
        // Aborting an already-dead recogniser is not an error worth raising.
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recog.current?.stop?.();
    } catch {
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) {
      setSupported(false);
      setError("הדפדפן הזה לא תומך בהכתבה. אפשר להקליד במקום.");
      return;
    }
    if (listening) return stop();

    // A previous instance still holding the mic makes start() throw.
    try {
      recog.current?.abort?.();
    } catch {
      /* nothing to abort */
    }

    const r = new Ctor();
    recog.current = r;
    r.lang = "he-IL";
    r.continuous = continuous;
    r.maxAlternatives = 1;
    r.interimResults = true;

    let final = "";
    started.current = false;

    r.onstart = () => {
      started.current = true;
      if (watchdog.current) clearTimeout(watchdog.current);
    };

    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      partialRef.current?.((final + interim).trim());
    };

    r.onerror = (e: any) => {
      if (watchdog.current) clearTimeout(watchdog.current);
      setListening(false);
      // The user stopping deliberately is not a failure.
      if (e?.error === "aborted") return;
      setError(ERRORS[e?.error] ?? `ההכתבה נכשלה (${e?.error ?? "לא ידוע"}).`);
    };

    r.onend = () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      setListening(false);
      const text = final.trim();
      if (text) finalRef.current(text);
    };

    try {
      setError(null);
      setListening(true);
      r.start();
    } catch (err) {
      setListening(false);
      setError(`לא הצלחתי להפעיל את ההכתבה (${(err as Error).name}).`);
      return;
    }

    // Nothing ever fired: the API exists but is inert. Common on iOS with
    // dictation disabled, where no error event arrives either.
    watchdog.current = setTimeout(() => {
      if (started.current) return;
      try {
        r.abort?.();
      } catch {
        /* already gone */
      }
      setListening(false);
      setError(
        "ההכתבה לא נענתה. ודא שהכתבה מופעלת (הגדרות ← כללי ← מקלדת) ושיש הרשאת מיקרופון, או הקלד."
      );
    }, 2500);
  }, [listening, stop, continuous]);

  return {
    supported,
    listening,
    error,
    start,
    stop,
    clearError: useCallback(() => setError(null), []),
  };
}
