"use client";

import { useEffect, useState } from "react";
import { Code, Play, SlidersHorizontal } from "@phosphor-icons/react";
import type { ExecutionRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WorkflowPanelProps {
  nodeCount: number;
  edgeCount: number;
  route: ExecutionRoute;
  hasModel: boolean;
  errors: number;
  warnings: number;
  onExecute: () => void;
  onCode: () => void;
}

interface EngineInfo {
  engine?: string;
  python_version?: string | null;
  machine_check?: string | null;
}

export function WorkflowPanel({ nodeCount, edgeCount, route, hasModel, errors, warnings, onExecute, onCode }: WorkflowPanelProps) {
  const [engine, setEngine] = useState<EngineInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/execute")
      .then((res) => res.json())
      .then((data: EngineInfo) => { if (!cancelled) setEngine(data); })
      .catch(() => { if (!cancelled) setEngine({}); });
    return () => { cancelled = true; };
  }, []);

  const native = engine?.engine === "native-python";
  const statusTone = errors > 0 ? "text-rose-500" : hasModel ? "text-emerald-500" : "text-amber-500";

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-l border-neutral-200/80 bg-white/70 glass-panel lg:flex dark:bg-[#050506]/60">
      <div className="border-b border-neutral-200/80 px-5 py-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} weight="regular" className="text-neutral-400 dark:text-zinc-500" />
          <h2 className="text-[13px] font-semibold tracking-tight text-neutral-900 dark:text-white">Workflow</h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">Review the pipeline before running it.</p>
      </div>

      <div className="border-b border-neutral-200/80 px-5 py-5 dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="nf-hud-label">status</span>
          <span className={cn("text-[11px] font-semibold", statusTone)}>
            {errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : hasModel ? "Ready" : "Incomplete"}
          </span>
        </div>
        {warnings > 0 ? (
          <div className="mt-2.5 flex items-center justify-between">
            <span className="nf-hud-label">warnings</span>
            <span className="text-[11px] font-semibold text-amber-500">{warnings}</span>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Summary label="steps" value={nodeCount} />
          <Summary label="links" value={edgeCount} />
        </div>
      </div>

      <div className="border-b border-neutral-200/80 px-5 py-5 dark:border-white/[0.06]">
        <p className="nf-hud-label">execution</p>
        <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-neutral-400 dark:text-zinc-500">Runtime</span><span className="font-medium text-neutral-700 dark:text-zinc-300">{route === "colab" ? "Colab GPU" : "Instant CPU"}</span></div>
        <div className="mt-2 flex items-center justify-between text-[11px]"><span className="text-neutral-400 dark:text-zinc-500">Trigger</span><span className="font-medium text-neutral-700 dark:text-zinc-300">Manual</span></div>
        <div className="mt-2 flex items-center justify-between text-[11px]"><span className="text-neutral-400 dark:text-zinc-500">Persistence</span><span className="font-medium text-neutral-700 dark:text-zinc-300">Local project</span></div>
        <div className="mt-4 border-t border-neutral-200/80 pt-3 dark:border-white/[0.06]">
          <p className="nf-hud-label">server engine</p>
          {engine === null ? (
            <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-zinc-500">Checking deployment…</p>
          ) : native ? (
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-emerald-500">Native Python {engine.python_version}: the full model suite trains here.</p>
          ) : (
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-amber-500">
              Built-in TypeScript fallback{engine.machine_check ? ` (${engine.machine_check})` : ""}. Only KNN and Naive Bayes train; add a Python ML stack to this server for the rest. Your own computer is never used for training.
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-2 border-t border-neutral-200/80 p-5 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={onExecute}
          disabled={!hasModel}
          className="group relative inline-flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-neutral-900 text-xs font-semibold text-white transition-all duration-300 hover:bg-neutral-700 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full dark:bg-neutral-900/10" />
          <Play size={13} weight="fill" className="relative" />
          <span className="relative">Run workflow</span>
        </button>
        <button
          type="button"
          onClick={onCode}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white/50 px-3 text-xs font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900 active:scale-[0.97] dark:border-white/[0.09] dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-white"
        >
          <Code size={13} /> View generated code
        </button>
      </div>
    </aside>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200/80 bg-white/50 px-3 py-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
      <p className="font-mono text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{value}</p>
      <p className="nf-hud-label mt-1">{label}</p>
    </div>
  );
}

export default WorkflowPanel;
