"use client";

import { useEffect, useState } from "react";
import { Code, Play, SlidersHorizontal } from "@phosphor-icons/react";
import type { ExecutionRoute } from "@/lib/types";

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
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-l border-border bg-surface lg:flex">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} weight="regular" className="text-muted-2" />
          <h2 className="text-xs font-semibold text-foreground">Workflow</h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Review the pipeline before running it.</p>
      </div>

      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">Status</span>
          <span className={`flex items-center text-[11px] font-medium ${errors > 0 ? "text-rose-500" : hasModel ? "text-emerald-500" : "text-amber-500"}`}>
            {errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : hasModel ? "Ready" : "Incomplete"}
          </span>
        </div>
        {warnings > 0 ? (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted">Warnings</span>
            <span className="text-[11px] font-medium text-amber-500">{warnings}</span>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Summary label="Steps" value={nodeCount} />
          <Summary label="Connections" value={edgeCount} />
        </div>
      </div>

      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Execution</p>
        <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-muted">Runtime</span><span className="font-medium text-foreground-2">{route === "colab" ? "Colab GPU" : "Instant CPU"}</span></div>
        <div className="mt-2 flex items-center justify-between text-[11px]"><span className="text-muted">Trigger</span><span className="font-medium text-foreground-2">Manual</span></div>
        <div className="mt-2 flex items-center justify-between text-[11px]"><span className="text-muted">Persistence</span><span className="font-medium text-foreground-2">Local project</span></div>
        <div className="mt-3 border-t border-border pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Server engine</p>
          {engine === null ? (
            <p className="mt-1 text-[11px] text-muted">Checking deployment…</p>
          ) : native ? (
            <p className="mt-1 text-[11px] leading-snug text-emerald-500">Native Python {engine.python_version} — full model suite trains here.</p>
          ) : (
            <p className="mt-1 text-[11px] leading-snug text-amber-500">
              Built-in TypeScript fallback{engine.machine_check ? ` (${engine.machine_check})` : ""}. Only KNN and Naive Bayes train; add a Python ML stack to this server for the rest. Your own computer is never used for training.
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-2 border-t border-border p-4">
        <button type="button" onClick={onExecute} disabled={!hasModel} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"><Play size={14} weight="fill" /> Run workflow</button>
        <button type="button" onClick={onCode} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground-2 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"><Code size={14} /> View generated code</button>
      </div>
    </aside>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-border bg-background px-3 py-2"><p className="font-mono text-base font-semibold text-foreground">{value}</p><p className="mt-0.5 text-[10px] text-muted">{label}</p></div>;
}

export default WorkflowPanel;

