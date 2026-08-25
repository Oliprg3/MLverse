"use client";

/**
 * TextColumnsFixModal — the human-confirm step for the "Text column feeds a
 * numeric pipeline" pipeline check. The canvas proposes a rewrite and asks for
 * permission: pick drop / label-encode / one-hot per column, confirm, and the
 * dataset on the source node is rewritten in place.
 */

import { useMemo, useState } from "react";
import { Check, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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

const ACTIONS: Array<{ id: TextColumnAction; label: string; title: string }> = [
  { id: "drop", label: "Drop", title: "Remove the column from the dataset" },
  { id: "label", label: "Encode", title: "Map each unique value to 0, 1, 2…" },
  { id: "onehot", label: "One-hot", title: "Explode into a 0/1 column per unique value" },
];

export function TextColumnsFixModal({ open, onClose, dataset, columns, onApply }: TextColumnsFixModalProps) {
  // The canvas only mounts this component while a fix is pending, so the
  // lazy initializer runs once per confirmation session.
  const [decisions, setDecisions] = useState<Record<string, TextColumnAction>>(() =>
    Object.fromEntries(columns.map((column) => [column, "drop" as TextColumnAction])),
  );

  const samples = useMemo(() => {
    const map = new Map<string, string>();
    if (!dataset) return map;
    const header = dataset.csvText.split(/\r?\n/)[0] ?? "";
    const delimiter = header.includes(";") && !header.includes(",") ? ";" : ",";
    const rows = dataset.csvText.split(/\r?\n/).slice(1, 30);
    for (const column of columns) {
      const idx = header.split(delimiter).findIndex((h) => h.trim().replace(/^"|"$/g, "") === column);
      if (idx === -1) continue;
      const uniques = Array.from(new Set(rows.map((r) => (r.split(delimiter)[idx] ?? "").trim()).filter(Boolean)));
      map.set(column, uniques.slice(0, 3).map((v) => `“${v}”`).join(", "));
    }
    return map;
  }, [dataset, columns]);

  if (!open || !dataset) return null;

  const drops = columns.filter((c) => decisions[c] === "drop").length;
  const encodes = columns.length - drops;
  const oneHot = columns.filter((c) => decisions[c] === "onehot").length;

  const apply = () => {
    const result = applyTextColumnResolutions(dataset, decisions);
    const bits: string[] = [];
    if (result.dropped.length > 0) bits.push(`dropped ${result.dropped.length}`);
    if (result.encoded.length > 0) bits.push(`encoded ${result.encoded.length}`);
    onApply(result.dataset, `${bits.join(", ")}${result.added > 0 ? `, +${result.added} one-hot cols` : ""}`);
  };

  const summaryBits: string[] = [];
  if (drops > 0) summaryBits.push(`${drops} dropped`);
  if (encodes > 0) summaryBits.push(`${encodes} encoded`);
  if (oneHot > 0) summaryBits.push(`${oneHot} one-hot`);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fix text columns"
      subtitle={`“${dataset.filename}” — choose how to handle each non-numeric column, then confirm.`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {summaryBits.length > 0 ? summaryBits.join(" · ") : "Nothing selected"}
            <span className="ml-2 hidden font-mono text-[10.5px] text-muted/70 sm:inline">
              {dataset.nrows.toLocaleString()} rows kept
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={apply}>
              <Check size={14} weight="bold" /> Confirm &amp; fix
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Warning size={13} weight="fill" className="shrink-0" />
          {columns.length} column{columns.length === 1 ? "" : "s"} with text values would break the numeric pipeline.
        </p>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="divide-y divide-border/60">
            {columns.map((column) => (
              <div key={column} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{column}</p>
                  {samples.get(column) ? (
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted" title={samples.get(column)}>
                      {samples.get(column)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 rounded-lg border border-border p-0.5" role="group" aria-label={`Fix for ${column}`}>
                  {ACTIONS.map((action) => {
                    const active = decisions[column] === action.id;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        title={action.title}
                        aria-pressed={active}
                        onClick={() => setDecisions((d) => ({ ...d, [column]: action.id }))}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                          active ? "bg-foreground text-background" : "text-muted hover:text-foreground",
                        )}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          The dataset on the node is rewritten in place — the original file on your device is never touched. The target column is left as-is.
        </p>
      </div>
    </Modal>
  );
}

export default TextColumnsFixModal;
