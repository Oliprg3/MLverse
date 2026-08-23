"use client";

import { useState } from "react";
import { CaretDown, Check, Lightning, Warning, XCircle } from "@phosphor-icons/react";
import { summarizeDiagnostics, type Diagnostic } from "@/lib/pipelineValidation";
import { cn } from "@/lib/utils";

interface ProblemsPanelProps {
  diagnostics: Diagnostic[];
  onSelectNode?: (nodeId: string) => void;
  onApplyFix?: (diagnostic: Diagnostic) => void;
}

/**
 * Floating validation report for the canvas. Diagnostics that carry a fix
 * render a one-click repair; the header offers to apply every available
 * fix in sequence until the pipeline is clean.
 */
export function ProblemsPanel({ diagnostics, onSelectNode, onApplyFix }: ProblemsPanelProps) {
  const [open, setOpen] = useState(true);
  const { errors, warnings, fixes } = summarizeDiagnostics(diagnostics);
  if (diagnostics.length === 0) return null;

  const fixable = diagnostics.filter((d) => d.fix);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-10 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg backdrop-blur-md">
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
          {errors === 0 && warnings === 0 ? <span className="text-emerald-500">clean</span> : null}
        </span>
        <span className="flex items-center gap-2">
          {fixable.length > 0 && errors + warnings > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                for (const diagnostic of fixable) onApplyFix?.(diagnostic);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  for (const diagnostic of fixable) onApplyFix?.(diagnostic);
                }
              }}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10"
            >
              <Lightning size={10} weight="fill" /> Fix all {fixable.length}
            </span>
          ) : null}
          <CaretDown size={11} className={cn("shrink-0 text-muted transition-transform duration-200", !open && "-rotate-90")} />
        </span>
      </button>
      <div className={cn("grid transition-all duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <ul className="scroll-thin max-h-52 divide-y divide-border/60 overflow-y-auto border-t border-border">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic.id} className="group flex items-start gap-2.5 px-3 py-2">
                <button
                  type="button"
                  disabled={!diagnostic.nodeId || !onSelectNode}
                  onClick={() => diagnostic.nodeId && onSelectNode?.(diagnostic.nodeId)}
                  className="flex min-w-0 flex-1 items-start gap-2.5 text-left disabled:cursor-default"
                >
                  {diagnostic.level === "error"
                    ? <XCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-rose-500" />
                    : <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />}
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium leading-tight text-foreground">{diagnostic.title}</span>
                    <span className="mt-0.5 block break-words text-[11px] leading-snug text-muted">{diagnostic.detail}</span>
                  </span>
                </button>
                {diagnostic.fix ? (
                  <button
                    type="button"
                    onClick={() => onApplyFix?.(diagnostic)}
                    title="Apply this fix automatically"
                    className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground-2 transition-colors hover:border-emerald-500/50 hover:text-emerald-500"
                  >
                    <Check size={10} weight="bold" /> Fix
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ProblemsPanel;
