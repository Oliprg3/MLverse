"use client";

import { useState } from "react";
import { CaretDown, Warning, XCircle } from "@phosphor-icons/react";
import { summarizeDiagnostics, type Diagnostic } from "@/lib/pipelineValidation";
import { cn } from "@/lib/utils";

interface ProblemsPanelProps {
  diagnostics: Diagnostic[];
  onSelectNode?: (nodeId: string) => void;
}

/**
 * Floating validation report for the canvas. Lists structural and type
 * problems found by the pipeline validator; clicking an entry focuses the
 * offending node.
 */
export function ProblemsPanel({ diagnostics, onSelectNode }: ProblemsPanelProps) {
  const [open, setOpen] = useState(true);
  const { errors, warnings } = summarizeDiagnostics(diagnostics);
  if (diagnostics.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-10 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.03]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          Pipeline check
          {errors > 0 ? <span className="font-mono text-[11px] font-medium text-rose-500">{errors} error{errors > 1 ? "s" : ""}</span> : null}
          {warnings > 0 ? <span className="font-mono text-[11px] font-medium text-amber-500">{warnings} warning{warnings > 1 ? "s" : ""}</span> : null}
        </span>
        <CaretDown size={11} className={cn("shrink-0 text-muted transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <div className={cn("grid transition-all duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <ul className="scroll-thin max-h-52 divide-y divide-border/60 overflow-y-auto border-t border-border">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic.id}>
                <button
                  type="button"
                  disabled={!diagnostic.nodeId || !onSelectNode}
                  onClick={() => diagnostic.nodeId && onSelectNode?.(diagnostic.nodeId)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {diagnostic.level === "error"
                    ? <XCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-rose-500" />
                    : <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />}
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium leading-tight text-foreground">{diagnostic.title}</span>
                    <span className="mt-0.5 block break-words text-[11px] leading-snug text-muted">{diagnostic.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ProblemsPanel;
