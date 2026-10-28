"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, Table, ChartBar, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { DataProfile, ProfileColumn } from "@/lib/types";

/**
 * DataExplorer — the interactive surface real analytics tools all ship.
 *
 * Research on Exploratory, Power BI, Azure Data Explorer's "Explore data" and
 * RATH showed a shared pattern: a columns pane showing per-column metadata and
 * value distributions, next to the underlying rows, with selection driving
 * which column is inspected. The existing profile only reported aggregates —
 * useful, but you could not see the data or a distribution without leaving the
 * app.
 *
 * This is that surface, scoped to what the engine already returns: a column
 * list, the selected column's distribution, and the real rows.
 */

type View = "data" | "distribution";

function kindOf(column: ProfileColumn): "numeric" | "categorical" {
  return column.mean === null || column.mean === undefined ? "categorical" : "numeric";
}

/** Render a cell compactly without lying about precision. */
function cell(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    if (Number.isInteger(value)) return String(value);
    const abs = Math.abs(value);
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) return value.toExponential(2);
    return value.toFixed(3).replace(/\.?0+$/, "");
  }
  return value;
}

function Distribution({ column }: { column: ProfileColumn }) {
  const hist = column.histogram;
  if (!hist) {
    return <p className="px-4 py-8 text-center text-xs text-muted">No distribution available for this column.</p>;
  }

  if (hist.kind === "numeric" && hist.counts?.length && hist.edges?.length) {
    const max = Math.max(...hist.counts, 1);
    const width = 100 / hist.counts.length;
    return (
      <div>
        <div className="flex h-[150px] items-end gap-[2px]" role="img" aria-label={`Distribution of ${column.name}`}>
          {hist.counts.map((count, i) => {
            const lo = hist.edges![i];
            const hi = hist.edges![i + 1];
            return (
              <div
                key={i}
                className="group relative rounded-t-sm bg-neutral-900/75 transition-colors hover:bg-neutral-900 dark:bg-white/75 dark:hover:bg-white"
                style={{ width: `${width}%`, height: `${Math.max(2, (count / max) * 100)}%` }}
                title={`${cell(lo)} – ${cell(hi)}: ${count} rows`}
              >
                {/* Raw count on hover — the number analysts need, not just a bar. */}
                <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-foreground group-hover:block">
                  {count}
                </span>
                <span className="sr-only">{cell(lo)} to {cell(hi)}: {count} rows</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-2">
          <span>{cell(hist.edges[0])}</span>
          <span>{cell(hist.edges[hist.edges.length - 1])}</span>
        </div>
      </div>
    );
  }

  const top = hist.top ?? [];
  const max = Math.max(...top.map((t) => t.count), 1);
  if (!top.length) {
    return <p className="px-4 py-8 text-center text-xs text-muted">No distribution available for this column.</p>;
  }
  return (
    <div className="space-y-1.5">
      {top.map((entry) => (
        <div key={entry.value} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate font-mono text-[10px] text-muted-2" title={entry.value}>
            {entry.value}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <div className="h-full rounded-full bg-neutral-900/70 dark:bg-white/70" style={{ width: `${(entry.count / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{entry.count}</span>
        </div>
      ))}
    </div>
  );
}

export function DataExplorer({ profile }: { profile: DataProfile }) {
  const [view, setView] = useState<View>("data");
  const [selected, setSelected] = useState<number>(0);

  const columns = profile.columns_profile ?? [];
  const columnNames = profile.column_names ?? columns.map((c) => c.name);
  const rows = profile.sample_rows ?? [];
  const active = columns[selected];

  // Grid headers are feature columns plus the target, matching the row shape
  // the engine returns.
  const headers = useMemo(() => [...columnNames, profile.target_name ?? "target"], [columnNames, profile.target_name]);

  if (!columns.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-foreground/[0.02] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <MagnifyingGlass size={13} className="text-muted" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Data explorer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-2">
            {rows.length} row{rows.length === 1 ? "" : "s"}
            {profile.sample_truncated ? " (of " + profile.rows.toLocaleString() + ")" : ""}
          </span>
          <div className="flex overflow-hidden rounded-lg border border-border" role="tablist" aria-label="Explorer view">
            {(["data", "distribution"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  view === mode ? "bg-foreground/[0.07] text-foreground" : "text-muted hover:text-foreground-2",
                )}
              >
                {mode === "data" ? <Table size={12} /> : <ChartBar size={12} />}
                {mode === "data" ? "Data" : "Distribution"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* columns pane — mirrors Azure Data Explorer's columns pane */}
        <div className="max-h-[220px] shrink-0 overflow-y-auto border-b border-border lg:w-60 lg:max-h-[420px] lg:border-b-0 lg:border-r">
          <div className="sticky top-0 border-b border-border bg-background/95 px-3 py-1.5 backdrop-blur">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
              {columns.length} columns
            </span>
          </div>
          <ul>
            {columns.map((column, index) => (
              <li key={column.index}>
                <button
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-current={selected === index ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                    selected === index ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
                  )}
                >
                  <span
                    className="font-mono text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: kindOf(column) === "numeric" ? "#3eb8a8" : "#cf8f4e" }}
                  >
                    {kindOf(column) === "numeric" ? "123" : "abc"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2" title={column.name}>
                    {column.name}
                  </span>
                  {column.missing > 0 ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                      title={`${column.missing} missing (${column.missing_pct?.toFixed(1)}%)`}
                    >
                      <Warning size={9} weight="fill" />
                      {column.missing_pct?.toFixed(0)}%
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* panel */}
        <div className="min-w-0 flex-1">
          {active ? (
            <>
              <div className="border-b border-border px-4 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[13px] font-semibold tracking-tight">{active.name}</span>
                  <span className="font-mono text-[10px] text-muted-2">{kindOf(active)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-muted-2">
                  <span>unique {active.unique}</span>
                  <span>missing {active.missing}</span>
                  {active.mean !== null && active.mean !== undefined ? (
                    <>
                      <span>mean {cell(active.mean)}</span>
                      <span>std {cell(active.std)}</span>
                      <span>min {cell(active.min)}</span>
                      <span>median {cell(active.median)}</span>
                      <span>max {cell(active.max)}</span>
                    </>
                  ) : active.top_value !== undefined ? (
                    <span>most common {active.top_value} ({active.top_pct?.toFixed(1)}%)</span>
                  ) : null}
                </div>
              </div>

              {view === "distribution" ? (
                <div className="p-4">
                  <Distribution column={active} />
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur">
                      <tr className="border-b border-border">
                        {headers.map((header, index) => (
                          <th
                            key={`${header}-${index}`}
                            scope="col"
                            onClick={() => {
                              const columnIndex = index < columns.length ? index : selected;
                              setSelected(columnIndex);
                            }}
                            className={cn(
                              "cursor-pointer whitespace-nowrap px-3 py-2 text-left font-medium transition-colors hover:text-foreground",
                              index < columns.length && columns[index] && selected === index ? "text-foreground" : "text-muted-2",
                              index === headers.length - 1 && "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
                          {row.map((value, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={cn(
                                "whitespace-nowrap px-3 py-1.5 tabular-nums",
                                cellIndex === headers.length - 1 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-foreground-2",
                              )}
                            >
                              {cell(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {profile.sample_truncated ? (
                    <p className="px-4 py-2.5 text-[11px] text-muted-2">
                      Showing the first {rows.length} of {profile.rows.toLocaleString()} rows.
                    </p>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DataExplorer;