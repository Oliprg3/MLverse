"use client";

import { useEffect, useMemo, useState } from "react";
import { Broom, Check, Warning } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  analyzeCsv,
  applyCleaning,
  buildCleaningPlan,
  defaultStrategy,
  hasIssues,
  STRATEGY_LABEL,
  type CleanStrategy,
  type CsvIssues,
} from "@/lib/dataCleaning";
import type { CsvDataset } from "@/lib/types";

const STRATEGIES: CleanStrategy[] = ["median", "mean", "mode", "zero", "drop"];

interface DataCleaningModalProps {
  dataset: CsvDataset | null;
  open: boolean;
  onClose: () => void;
  onApply: (dataset: CsvDataset, summary: string) => void;
}

/**
 * Detects data-quality problems in the attached CSV and lets the user repair
 * them column-by-column (mean / median / mode / zero / drop rows) with a
 * preview of the exact replacements before anything is written.
 */
export function DataCleaningModal({ dataset, open, onClose, onApply }: DataCleaningModalProps) {
  const [strategies, setStrategies] = useState<Record<string, CleanStrategy>>({});

  const issues: CsvIssues | null = useMemo(() => (dataset ? analyzeCsv(dataset) : null), [dataset]);

  const dirtyColumns = useMemo(() => {
    if (!issues) return [];
    return issues.columns
      .filter((c) => c.kind === "missing" || c.kind === "text")
      .map((c) => ("column" in c ? c.column : ""))
      .filter(Boolean);
  }, [issues]);

  // Defaults derived during render; explicit user overrides win.
  const effective = useMemo(() => {
    const base: Record<string, CleanStrategy> = {};
    if (dataset && open) for (const column of dirtyColumns) base[column] = defaultStrategy(dataset, column);
    return { ...base, ...strategies };
  }, [dataset, open, dirtyColumns, strategies]);

  const plan = useMemo(
    () => (dataset && open && Object.keys(effective).length > 0 ? buildCleaningPlan(dataset, effective) : null),
    [dataset, open, effective],
  );

  if (!dataset || !issues) return null;
  const clean = !hasIssues(issues);

  const apply = () => {
    if (!plan || plan.totalReplacements + plan.rowsDropped === 0) return;
    const { dataset: cleaned, replacements, rowsDropped } = applyCleaning(dataset, effective);
    const parts: string[] = [];
    if (replacements > 0) parts.push(`${replacements} value${replacements === 1 ? "" : "s"} filled`);
    if (rowsDropped > 0) parts.push(`${rowsDropped} row${rowsDropped === 1 ? "" : "s"} dropped`);
    onApply(cleaned, parts.join(", ") || "Data cleaned");
    setStrategies({});
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Broom size={16} className="text-primary" /> Data cleaning: {dataset.filename}
        </span>
      }
      subtitle="Review the detected issues, choose how to fill each column, then apply."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">
            {plan && plan.totalReplacements + plan.rowsDropped > 0
              ? `${plan.totalReplacements} value${plan.totalReplacements === 1 ? "" : "s"} to fill${plan.rowsDropped > 0 ? `, ${plan.rowsDropped} row${plan.rowsDropped === 1 ? "" : "s"} dropped` : ""}`
              : "Nothing selected to clean"}
          </p>
          <Button variant="primary" size="sm" onClick={apply} disabled={!plan || plan.totalReplacements + plan.rowsDropped === 0}>
            <Check size={14} weight="bold" /> Apply cleaning
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {clean ? (
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
            <Check size={18} weight="fill" className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">No issues detected</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                No missing cells, no text in numeric columns, and no duplicate rows in the first 5 000 rows.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Issue summary */}
            <div className="grid gap-2 sm:grid-cols-3">
              {issues.missingTotal > 0 ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-500"><Warning size={13} weight="fill" /> Missing cells</p>
                  <p className="mt-1 font-mono text-lg font-extrabold text-foreground">{issues.missingTotal}</p>
                </div>
              ) : null}
              {issues.columns.some((c) => c.kind === "text") ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-500"><Warning size={13} weight="fill" /> Text in numeric cols</p>
                  <p className="mt-1 font-mono text-lg font-extrabold text-foreground">{issues.columns.filter((c) => c.kind === "text").length}</p>
                </div>
              ) : null}
              {issues.duplicateRows > 0 ? (
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs font-bold text-muted">Duplicate rows</p>
                  <p className="mt-1 font-mono text-lg font-extrabold text-foreground">{issues.duplicateRows}</p>
                </div>
              ) : null}
            </div>

            {/* Column strategies */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">How should each column be filled?</p>
              <div className="mt-2 divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
                {dirtyColumns.map((column) => {
                  const issue = issues.columns.find((c) => "column" in c && c.column === column);
                  return (
                    <div key={column} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">{column}</p>
                        <p className="text-[10.5px] text-muted">
                          {issue?.kind === "missing" ? `${issue.count} missing` : ""}
                          {issue?.kind === "text" ? `${issue.count} non-numeric (e.g. ${issue.samples.slice(0, 2).map((s) => `"${s}"`).join(", ")})` : ""}
                        </p>
                      </div>
                      <select
                        value={effective[column] ?? "median"}
                        onChange={(e) => setStrategies((s) => ({ ...s, [column]: e.target.value as CleanStrategy }))}
                        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                      >
                        {STRATEGIES.map((s) => (
                          <option key={s} value={s}>{STRATEGY_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Replacement preview */}
            {plan && plan.preview.length > 0 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Preview: what gets written</p>
                <div className="mt-2 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-foreground/[0.04] text-left text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Row</th>
                        <th className="px-3 py-2 font-semibold">Column</th>
                        <th className="px-3 py-2 font-semibold">Was</th>
                        <th className="px-3 py-2 font-semibold">Becomes</th>
                        <th className="px-3 py-2 font-semibold">Rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.preview.map((r, i) => (
                        <tr key={`${r.rowIndex}-${r.column}-${i}`} className="border-t border-border/60">
                          <td className="px-3 py-1.5 font-mono text-muted">#{r.rowIndex + 2}</td>
                          <td className="px-3 py-1.5 font-medium text-foreground-2">{r.column}</td>
                          <td className="px-3 py-1.5 font-mono text-rose-400">{r.from}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-primary">{r.to}</td>
                          <td className="px-3 py-1.5 text-muted">{STRATEGY_LABEL[r.strategy]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {plan.totalReplacements > plan.preview.length ? (
                    <p className="border-t border-border/60 bg-foreground/[0.02] px-3 py-1.5 text-[10.5px] text-muted">
                      Showing first {plan.preview.length} of {plan.totalReplacements} replacements
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

export default DataCleaningModal;
