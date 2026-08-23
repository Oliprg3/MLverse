"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";

export type TerminalLevel = "info" | "success" | "error" | "system";

export interface TerminalLine {
  id: number;
  text: string;
  time: Date;
  durationMs?: number;
  level: TerminalLevel;
}

interface MemorySample {
  usedMB: number | null;
  limitMB: number | null;
}

function readMemory(): MemorySample {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
  if (perf.memory) {
    return {
      usedMB: Math.round((perf.memory.usedJSHeapSize / 1048576) * 10) / 10,
      limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1048576),
    };
  }
  return { usedMB: null, limitMB: null };
}

const LEVEL_STYLE: Record<TerminalLevel, string> = {
  info: "text-slate-300",
  success: "text-emerald-400",
  error: "text-rose-400",
  system: "text-sky-300",
};

function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Async execution console: timestamped NDJSON pipeline events with inter-step
 * durations, a live total clock, and browser heap sampling where available.
 * All clock/memory reads happen in effects so renders stay pure.
 */
export function TerminalConsole({ lines, running }: { lines: TerminalLine[]; running: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [memory, setMemory] = useState<MemorySample>({ usedMB: null, limitMB: null });

  useEffect(() => {
    if (!running) return;
    // Clock + heap reads live inside timer callbacks to keep renders pure.
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
    const memTimer = window.setTimeout(() => setMemory(readMemory()), 300);
    return () => {
      window.clearInterval(clockTimer);
      window.clearTimeout(memTimer);
    };
  }, [running]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  const startedAt = lines[0]?.time.getTime() ?? null;
  const lastAt = lines[lines.length - 1]?.time.getTime() ?? null;
  const liveNow = running ? nowMs : null;
  const elapsedEnd = liveNow ?? lastAt;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-foreground/[0.03] px-3 py-2 font-mono text-[11px] text-muted-2">
        <span className="flex items-center gap-2">
          {running ? <CircleNotch size={12} className="animate-spin text-sky-400" /> : <span aria-hidden>■</span>}
          pipeline terminal
        </span>
        <span className="hidden items-center gap-3 sm:flex">
          {memory.usedMB !== null ? <span title={`Heap limit ${memory.limitMB} MB`}>heap {memory.usedMB} MB</span> : null}
          {startedAt !== null && elapsedEnd !== null ? (
            <span>
              {running ? "elapsed" : "total"} {hhmmss(elapsedEnd - startedAt)}
            </span>
          ) : null}
        </span>
      </div>
      <div ref={scrollRef} className="scroll-thin max-h-56 min-h-[7rem] overflow-y-auto bg-[#0b0f17] px-4 py-3 font-mono text-[12px] leading-relaxed dark:bg-black/40">
        {lines.length === 0 && !running ? (
          <p className="text-slate-500">Waiting for a run…</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex items-baseline gap-3 whitespace-pre-wrap">
              <span className="shrink-0 select-none text-slate-600">{line.time.toLocaleTimeString([], { hour12: false })}</span>
              <span className={LEVEL_STYLE[line.level]}>{line.text}</span>
              {line.durationMs !== undefined && line.durationMs >= 50 ? (
                <span className="ml-auto hidden shrink-0 select-none text-slate-500 sm:inline">+{(line.durationMs / 1000).toFixed(1)}s</span>
              ) : null}
            </div>
          ))
        )}
        {running ? <div className="mt-1 flex items-baseline gap-2 text-slate-500"><span className="animate-pulse">▍</span><span>streaming…</span></div> : null}
      </div>
    </div>
  );
}

export default TerminalConsole;
