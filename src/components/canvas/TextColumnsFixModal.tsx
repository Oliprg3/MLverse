"use client";

/**
 * TextColumnsFixModal — the human-confirm step for the "Text column feeds a
 * numeric pipeline" pipeline check. Instead of telling the user to go fix
 * their file, the canvas proposes a rewrite and asks for permission: pick
 * drop / label-encode / one-hot per column, confirm, and the dataset on the
 * source node is rewritten in place.
 */

import { useState } from "react";
import { CheckCircle, Lightning, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { applyTextColumnResolutions, type TextColumnAction } from "@/lib/dataCleaning";
import type { CsvDataset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TextColumnsFixModalProps {
  open: boolean;
  onClose: () => void;
  dataset: CsvDataset | null;
  columns: string[];
  onApply: (dataset: CsvDataset, summary: string) => void;
}

const ACTIONS: Array<{ id: TextColumnAction; label: string; hint: string }> = [
  { id: "drop", label: "Drop column", hint: "Remove it from the dataset entirely." },
  { id: "label", label: "Label encode", hint: "Map each unique text value to 0, 1, 2…" },
  { id: "onehot", label: "One-hot encode", hint: "Explode into a 0/1 column per unique value." },
];

export function TextColumnsFixModal({ open, onClose, dataset, columns, onApply }: TextColumnsFixModalProps) {
  // The canvas only mounts this component while a fix is pending, so the
  // lazy initializer runs once per confirmation session.
  const [decisions, setDecisions] = useState<Record<string, TextColumnAction>>(() =>
    Object.fromEntries(columns.map((column) => [column, "drop" as TextColumnAction])),
  );

  if (!open || !dataset) return null;

  const drops = Object.values(decisions).filter((a) => a === "drop").length;
  const encodes = columns.length - drops;
  const oneHotCount = columns.filter((c) => decisions[c] === "onehot").length;
  const summaryParts: string[] = [];
  if (drops > 0) summaryParts.push(`${drops} column${drops === 1 ? "" : "s"} dropped`);
  if (encodes > 0) summaryParts.push(`${encodes} column${encodes === 1 ? "" : "s"} encoded`);
  if (oneHotCount > 0) summaryParts.push(`${oneHotCount} one-hot`);

  const apply = () => {
    const result = applyTextColumnResolutions(dataset, decisions);
    const bits: string[] = [];
    if (result.dropped.length > 0) bits.push(`dropped ${result.dropped.length}`);
    if (result.encoded.length > 0) bits.push(`encoded ${result.encoded.length}`);
    onApply(result.dataset, `${bits.join(", ")}${result.added > 0 ? `, +${result.added} one-hot cols` : ""}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="animate-modal-in relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Fix text columns before training?</h2>
            <p className="mt-0.5 text-xs text-muted">
              “{dataset.filename}” — choose how to handle each non-numeric column, then confirm.
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 shrink-0 rounded-xl p-1.5 text-muted transition-colors hover:bg-foreground/[0.05] hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[11.5px] font-medium text-amber-500">
            <Warning size={13} weight="fill" />
            {columns.length} column{columns.length === 1 ? "" : "s"} with text values would break the numeric pipeline.
          </p>
          {columns.map((column) => {
            const idx = dataset.columns.indexOf(column);
            const sample = idx >= 0
              ? dataset.csvText.split(/\r?\n/).slice(1, 4).map((r) => (r.split(/[,;]/)[idx] ?? "").trim()).filter(Boolean).slice(0, 3)
              : [];
            return (
              <fieldset key={column} className="rounded-xl border border-neutral-200/80 p-3 dark:border-white/[0.07]">
                <legend className="flex items-center gap-2 px-1 text-xs font-bold tracking-tight text-neutral-800 dark:text-zinc-200">
                  {column}
                  {sample.length > 0 ? (
                    <span className="max-w-52 truncate font-mono text-[10px] font-normal text-neutral-400 dark:text-zinc-500">
                      e.g. {sample.map((s) => `“${s}”`).join(", ")}
                    </span>
                  ) : null}
                </legend>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      title={action.hint}
                      onClick={() => setDecisions((d) => ({ ...d, [column]: action.id }))}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors",
                        decisions[column] === action.id
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                          : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-white/[0.09] dark:text-zinc-400 dark:hover:text-white",
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <p className="text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">
            The source dataset on the node is rewritten in place — the original file on your device is never touched. The target column is left as-is.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-500 dark:text-zinc-400">
            <CheckCircle size={13} className="text-emerald-500" />
            {summaryParts.length > 0 ? summaryParts.join(" · ") : "Nothing selected"}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={apply}>
              <Lightning size={15} weight="fill" />
              Confirm &amp; Fix
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TextColumnsFixModal;
