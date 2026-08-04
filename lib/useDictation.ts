"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation, with iOS Safari treated as a first-class case.
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
  "not-allowed": "No microphone permission. Allow microphone access and try again.",
  "service-not-allowed":
    "Dictation is turned off on this device. Settings → General → Keyboard → Enable Dictation, then try again.",
  "no-speech": "I didn't hear anything. Try again, closer to the microphone.",
  network: "Dictation needs a stable network connection.",
  "audio-capture": "No microphone is available.",
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
  /** End the recording and deliver the transcript. */
  stop: () => void;
  /** End the recording and throw the transcript away. */
  cancel: () => void;
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
  /** Set when the user discards a recording, so `onend` stays silent. */
  const discarded = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  /** Finalized text carried across internal restarts of one recording. */
  const accumulated = useRef("");
  /** Set by stop()/cancel(): tells onend this is a real end, not a restart. */
  const stopping = useRef(false);

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
    discarded.current = false;
    stopping.current = true;
    try {
      recog.current?.stop?.();
    } catch {
      setListening(false);
    }
  }, []);

  const cancel = useCallback(() => {
    discarded.current = true;
    stopping.current = true;
    try {
      // abort(), not stop(): stop() still emits whatever it heard.
      recog.current?.abort?.();
    } catch {
      /* already gone */
    }
    setListening(false);
  }, []);

  // Recursive restarts go through a ref rather than calling `launch` from
  // inside its own body, which the exhaustive-deps rule can't reason about.
  const launchRef = useRef<(withWatchdog: boolean) => void>(() => {});

  // Launches one recognition burst. `continuous` mode is never handed to the
  // browser — Android Chrome's native continuous recognition silently
  // restarts and can emit duplicate finalized segments as distinct `results`
  // entries, which no amount of re-reading `results` can undo (that failure
  // looked like "add add add me also…", growing with every pause). Instead
  // we run reliable single-utterance bursts and restart them ourselves in
  // `onend`, carrying the finalized text forward in `accumulated`.
  const launch = useCallback(
    (withWatchdog: boolean) => {
      const Ctor = ctor();
      if (!Ctor) {
        setSupported(false);
        setError("This browser doesn't support dictation. You can type instead.");
        setListening(false);
        return;
      }

      const r = new Ctor();
      recog.current = r;
      r.lang = "en-US";
      r.continuous = false;
      r.maxAlternatives = 1;
      r.interimResults = true;

      // Rebuilt from scratch on every result event, rather than appending
      // the slice from `e.resultIndex` — see the comment above `launch`.
      let burstFinal = "";

      r.onstart = () => {
        started.current = true;
        if (watchdog.current) clearTimeout(watchdog.current);
      };

      r.onresult = (e: any) => {
        if (recog.current !== r) return;
        let done = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) done += t;
          else interim += t;
        }
        burstFinal = done;
        const whole = [accumulated.current, (done + interim).trim()]
          .filter(Boolean)
          .join(" ");
        partialRef.current?.(whole);
      };

      r.onerror = (e: any) => {
        if (recog.current !== r) return;
        // In continuous mode, silence between bursts ("no-speech") and our
        // own restart-driven "aborted" are routine, not failures — onend
        // decides whether to restart or finalize whatever was accumulated.
        if (continuous && (e?.error === "no-speech" || e?.error === "aborted")) {
          return;
        }
        // A genuine error (network, permission, no mic…): stop the burst loop
        // so onend finalizes what we have instead of restarting straight back
        // into the same failure.
        stopping.current = true;
        if (watchdog.current) clearTimeout(watchdog.current);
        setListening(false);
        // The user stopping deliberately is not a failure.
        if (e?.error === "aborted") return;
        setError(ERRORS[e?.error] ?? `Dictation failed (${e?.error ?? "unknown"}).`);
      };

      r.onend = () => {
        if (recog.current !== r) return;
        if (discarded.current) {
          if (watchdog.current) clearTimeout(watchdog.current);
          return;
        }

        const text = burstFinal.trim();
        accumulated.current = [accumulated.current, text].filter(Boolean).join(" ");

        if (continuous && !stopping.current) {
          // The burst ended on its own (a pause, or the recognizer's own
          // limits) — keep listening, carrying the accumulated text forward.
          launchRef.current(false);
          return;
        }

        if (watchdog.current) clearTimeout(watchdog.current);
        setListening(false);
        const whole = accumulated.current.trim();
        if (whole) finalRef.current(whole);
      };

      try {
        setListening(true);
        r.start();
      } catch (err) {
        setListening(false);
        setError(`I couldn't start dictation (${(err as Error).name}).`);
        return;
      }

      if (withWatchdog) {
        // Nothing ever fired: the API exists but is inert. Common on iOS
        // with dictation disabled, where no error event arrives either.
        watchdog.current = setTimeout(() => {
          if (started.current) return;
          try {
            r.abort?.();
          } catch {
            /* already gone */
          }
          setListening(false);
          setError(
            "Dictation didn't respond. Check that dictation is enabled (Settings → General → Keyboard) and that microphone access is allowed, or type instead."
          );
        }, 2500);
      }
    },
    [continuous]
  );
  useEffect(() => {
    launchRef.current = launch;
  });

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) {
      setSupported(false);
      setError("This browser doesn't support dictation. You can type instead.");
      return;
    }
    if (listening) return stop();

    // A previous instance still holding the mic makes start() throw.
    try {
      recog.current?.abort?.();
    } catch {
      /* nothing to abort */
    }

    accumulated.current = "";
    started.current = false;
    discarded.current = false;
    stopping.current = false;
    setError(null);

    launch(true);
  }, [listening, stop, launch]);

  return {
    supported,
    listening,
    error,
    start,
    stop,
    cancel,
    clearError: useCallback(() => setError(null), []),
  };
}
