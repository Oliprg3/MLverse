"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  Info,
  Warning,
  TrendUp,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { cn, formatPercent } from "@/lib/utils";
import type { DataProfile, ProfileColumn } from "@/lib/types";

/**
 * EdaReport — renders the profile returned by the Python data profiler.
 *
 * Deliberately table-first rather than chart-first: the questions a profile
 * answers ("which columns have gaps?", "what is the spread?", "which pairs are
 * collinear?") are answered faster by sorted numbers than by pictures. The only
 * picture is the correlation matrix, which has no readable tabular form.
 */

const LEVEL_STYLE = {
  ok: { icon: CheckCircle, ring: "border-emerald-500/30 bg-emerald-500/[0.06]", text: "text-emerald-600 dark:text-emerald-400" },
  info: { icon: Info, ring: "border-sky-500/30 bg-sky-500/[0.06]", text: "text-sky-600 dark:text-sky-400" },
  warn: { icon: Warning, ring: "border-amber-500/30 bg-amber-500/[0.06]", text: "text-amber-600 dark:text-amber-400" },
} as const;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">{label}</div>
      <div className={cn("mt-1.5 font-mono text-xl font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</div>
    </div>
  );
}

function skewTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-2";
  const magnitude = Math.abs(value);
  if (magnitude > 2) return "text-amber-600 dark:text-amber-400";
  if (magnitude > 1) return "text-neutral-600 dark:text-zinc-300";
  return "text-muted";
}

/** Diverging colour for r in [-1, 1] — blue/red like a standard corrgram. */
function corrColor(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "rgba(161,161,170,0.12)";
  const magnitude = Math.min(1, Math.abs(value));
  const alpha = 0.12 + magnitude * 0.78;
  return value >= 0 ? `rgba(239,68,68,${alpha.toFixed(3)})` : `rgba(56,189,248,${alpha.toFixed(3)})`;
}

function ColumnTable({ columns }: { columns: ProfileColumn[] }) {
  const [sortKey, setSortKey] = useState<keyof ProfileColumn>("index");
  const [ascending, setAscending] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...columns];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Missing values always sink, regardless of direction.
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return ascending ? av - bv : bv - av;
      return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [columns, sortKey, ascending]);

  const toggle = (key: keyof ProfileColumn) => {
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  };

  const header = (key: keyof ProfileColumn, label: string, className?: string) => (
    <th scope="col" className={cn("px-3 py-2 font-medium", className)}>
      <button
        type="button"
        onClick={() => toggle(key)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground"
      >
        {label}
        {sortKey === key ? <ArrowsDownUp size={10} weight="bold" /> : null}
      </button>
    </th>
  );

  const cell = (value: number | null | undefined, digits = 3) =>
    value === null || value === undefined ? (
      <span className="text-muted-3">—</span>
    ) : (
      <span className="tabular-nums">{Number(value).toFixed(digits)}</span>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead className="border-b border-border bg-background/60">
          <tr>
            {header("name", "column")}
            {header("missing", "missing", "text-right")}
            {header("unique", "unique", "text-right")}
            {header("mean", "mean", "text-right")}
            {header("std", "std", "text-right")}
            {header("min", "min", "text-right")}
            {header("median", "median", "text-right")}
            {header("max", "max", "text-right")}
            {header("skew", "skew", "text-right")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((column) => {
            const categorical = column.mean === null || column.mean === undefined;
            return (
              <tr key={column.index} className="border-b border-border/60 transition-colors last:border-0 hover:bg-background/60">
                <th scope="row" className="max-w-[220px] truncate px-3 py-2 text-left font-medium text-foreground" title={column.name}>
                  {column.name}
                </th>
                <td className={cn("px-3 py-2 text-right", column.missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted")}>
                  {column.missing > 0 ? `${column.missing} (${column.missing_pct?.toFixed(1)}%)` : "0"}
                </td>
                <td className="px-3 py-2 text-right text-muted tabular-nums">{column.unique}</td>
                {categorical ? (
                  <td colSpan={6} className="px-3 py-2 text-right text-muted-2">
                    categorical — most common <span className="text-foreground">{column.top_value}</span> ({column.top_pct?.toFixed(1)}%)
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right text-foreground-2">{cell(column.mean)}</td>
                    <td className="px-3 py-2 text-right text-muted">{cell(column.std)}</td>
                    <td className="px-3 py-2 text-right text-muted">{cell(column.min)}</td>
                    <td className="px-3 py-2 text-right text-foreground-2">{cell(column.median)}</td>
                    <td className="px-3 py-2 text-right text-muted">{cell(column.max)}</td>
                    <td className={cn("px-3 py-2 text-right", skewTone(column.skew))}>{cell(column.skew, 2)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CorrelationMatrix({ labels, matrix }: { labels: string[]; matrix: Array<Array<number | null>> }) {
  if (!labels.length || !matrix.length) return null;
  // Long feature names make an unreadable grid — truncate hard.
  const short = labels.map((label) => (label.length > 11 ? `${label.slice(0, 10)}…` : label));
  const size = labels.length;
  const cell = Math.max(14, Math.min(34, Math.floor(460 / Math.max(1, size))));

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex" style={{ paddingLeft: 120 }}>
          {short.map((label, i) => (
            <div key={i} className="flex items-center justify-center px-0.5 pb-1" style={{ width: cell }} title={labels[i]}>
              <span className="truncate font-mono text-[8px] text-muted-2" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        {matrix.map((row, r) => (
          <div key={r} className="flex items-center">
            <div className="w-[120px] shrink-0 truncate pr-2 text-right font-mono text-[9px] text-muted-2" title={labels[r]}>
              {short[r]}
            </div>
            {row.map((value, c) => (
              <div
                key={c}
                className="flex items-center justify-center"
                style={{ width: cell, height: cell, background: corrColor(value) }}
                title={`${labels[r]} × ${labels[c]}: ${value === null ? "n/a" : value.toFixed(3)}`}
              >
                {size <= 14 ? (
                  <span className="font-mono text-[7px] tabular-nums text-white/90 mix-blend-difference">
                    {value === null ? "" : value.toFixed(1)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ))}
        <div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-muted-2">
          <span>-1</span>
          <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg, rgba(56,189,248,0.9), rgba(161,161,170,0.12), rgba(239,68,68,0.9))" }} />
          <span>+1</span>
          <span className="ml-2">negative → positive correlation</span>
        </div>
      </div>
    </div>
  );
}

function ClassBalance({ target }: { target: DataProfile["target"] }) {
  if (!target?.classes?.length) return null;
  const worst = target.imbalance_ratio;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Target balance · {target.kind}</p>
        {worst ? <span className="font-mono text-[10px] text-muted">majority : minority = {worst.toFixed(1)}×</span> : null}
      </div>
      <div className="space-y-1.5">
        {target.classes.map((entry) => (
          <div key={entry.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate font-mono text-[10px] text-muted-2" title={entry.label}>{entry.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
              <div
                className="h-full rounded-full bg-neutral-900/70 dark:bg-white/70"
                style={{ width: `${Math.max(1, entry.pct ?? 0)}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">
              {entry.count.toLocaleString()} · {entry.pct?.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EdaReport({ profile }: { profile: DataProfile }) {
  if (profile.error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Profiling failed</p>
        <p className="mt-1 font-mono text-[11px] text-amber-700 dark:text-amber-300">{profile.error}</p>
      </div>
    );
  }

  const missingTone = profile.n_missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="rows" value={profile.rows.toLocaleString()} />
        <Stat label="columns" value={String(profile.columns)} />
        <Stat label="missing" value={profile.n_missing.toLocaleString()} tone={missingTone} />
        <Stat
          label="complete"
          value={formatPercent(1 - (profile.missing_pct ?? 0) / 100)}
          tone={profile.n_missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
        />
      </div>

      {/* Data-quality findings */}
      {profile.findings.length ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Data quality</p>
          {profile.findings.map((finding, i) => {
            const style = LEVEL_STYLE[finding.level];
            const Icon = style.icon;
            return (
              <div key={i} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", style.ring)}>
                <Icon size={16} weight="fill" className={cn("mt-0.5 shrink-0", style.text)} />
                <div className="min-w-0">
                  <p className={cn("text-xs font-semibold", style.text)}>{finding.title}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted">{finding.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ClassBalance target={profile.target} />

      {/* Per-column statistics */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">Column statistics · click a header to sort</p>
          <span className="font-mono text-[10px] text-muted-2">{profile.columns_profile.length} columns</span>
        </div>
        <div className="rounded-xl border border-border">
          <ColumnTable columns={profile.columns_profile} />
        </div>
      </div>

      {/* Correlation */}
      {profile.correlation_labels.length > 1 ? (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">
            Correlation · {profile.correlation_labels.length} numeric features
          </p>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <CorrelationMatrix labels={profile.correlation_labels} matrix={profile.correlation_matrix} />
          </div>
        </div>
      ) : null}

      {/* Collinear pairs */}
      {profile.high_correlation.length ? (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">
            Strongest correlated pairs
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {profile.high_correlation.map((pair, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2">
                <span className="min-w-0 truncate text-[11px] text-foreground-2">
                  {pair.a} <span className="text-muted-2">×</span> {pair.b}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] font-semibold tabular-nums",
                    pair.r >= 0 ? "text-rose-500" : "text-sky-500",
                  )}
                >
                  {pair.r >= 0 ? "+" : ""}
                  {pair.r.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EdaReport;