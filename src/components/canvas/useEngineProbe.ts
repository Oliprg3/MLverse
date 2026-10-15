"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * engineProbe.ts — waking a sleeping Render free-tier container, honestly.
 *
 * On the free tier the container spins down when idle. The first request after
 * that takes ~13s+ to answer, during which the UI previously said only
 * "Dispatching… streaming…" — indistinguishable from a hang, and long enough
 * that people re-clicked Run.
 *
 * This probe makes that wait visible and bounded:
 *  - polls with backoff while the container is asleep;
 *  - reports elapsed seconds so the wait is legible;
 *  - gives up with a clear, actionable message instead of hanging forever;
 *  - pre-warms on mount so the common case is paid before the user clicks.
 *
 * It reports what it knows and never invents a state it did not observe.
 */

export interface EngineStatus {
  engine: "native-python" | "typescript-fallback" | "unknown";
  python_version: string | null;
  torch: boolean;
  machine_check: string | null;
}

export type ProbePhase = "idle" | "probing" | "ready" | "unreachable";

/** Free tier can take a while; poll for ~90s before calling it unreachable. */
const PROBE_TIMEOUT_MS = 90_000;
const BACKOFF_MS = [0, 1200, 2500, 4000, 6000];

export function useEngineProbe(prewarm = true) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [phase, setPhase] = useState<ProbePhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startedRef.current !== null) {
      window.clearInterval(timerRef.current as unknown as number);
      timerRef.current = null;
      startedRef.current = null;
    }
  }, []);

  const run = useCallback(async () => {
    stop();
    const started = Date.now();
    startedRef.current = started;
    setPhase("probing");
    setElapsed(0);
    // Elapsed counter: the whole point is that the wait is visible.
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    startedRef.current = started;
    timerRef.current = tick;

    for (let i = 0; i < BACKOFF_MS.length; i += 1) {
      setAttempt(i + 1);
      if (BACKOFF_MS[i] > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
      }
      if (Date.now() - started > PROBE_TIMEOUT_MS) break;
      try {
        // No cache, and a hard timeout so one dead request cannot hang us.
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);
        const res = await fetch("/api/execute", { cache: "no-store", signal: controller.signal });
        window.clearTimeout(timeout);
        if (!res.ok) continue;
        const data = (await res.json()) as Partial<EngineStatus>;
        stop();
        setStatus({
          engine: data.engine === "native-python" ? "native-python" : data.engine === "typescript-fallback" ? "typescript-fallback" : "unknown",
          python_version: data.python_version ?? null,
          torch: Boolean(data.torch),
          machine_check: data.machine_check ?? null,
        });
        setPhase("ready");
        return true;
      } catch {
        // Container still asleep (or restarting) — back off and retry.
      }
    }
    stop();
    setPhase("unreachable");
    return false;
  }, [stop]);

  // Pre-warm so the cold start is usually already paid by the time Run is hit.
  // Deferred by a tick: the probe is async I/O, and setting state synchronously
  // inside the effect body would cascade a render on mount.
  useEffect(() => {
    if (!prewarm) return;
    const id = window.setTimeout(() => void run(), 0);
    return () => {
      window.clearTimeout(id);
      stop();
    };
  }, [prewarm, run, stop]);

  return {
    status,
    phase,
    elapsed,
    attempt,
    retry: run,
    isWaking: phase === "probing",
    isUnreachable: phase === "unreachable",
  };
}