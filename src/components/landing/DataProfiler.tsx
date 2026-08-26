"use client";

/**
 * DataProfiler — an interactive dataset profiler.
 *
 * Nothing here is mocked. Each tab generates its sample from a seeded
 * two-factor latent model, then the panel reports the descriptive statistics,
 * histograms and Pearson correlations actually measured on that sample —
 * including the profiling wall-time, which is timed with performance.now().
 */

import { useEffect, useMemo, useState } from "react";
import { Table, Target, Warning } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";
import { useInView } from "./useInView";
import {
  PROFILE_SPECS,
  buildProfile,
  topTargetCorrelations,
  type Profile,
  type ProfiledColumn,
} from "@/lib/landingLab";

/* ── Formatting ────────────────────────────────────────────────────── */

function fmtNum(v: number, unit?: string): string {
  const abs = Math.abs(v);
  let body: string;
  if (abs >= 1000) body = Math.round(v).toLocaleString("en-US");
  else if (abs >= 10) body = v.toFixed(1);
  else if (abs >= 1) body = v.toFixed(2);
  else body = v.toFixed(3);
  if (unit === "$") return `$${body}`;
  return unit ? `${body} ${unit}` : body;
}

/** Signed correlation with a typographic minus. */
function fmtR(r: number): string {
  const body = Math.abs(r).toFixed(2);
  if (r > 0.005) return `+${body}`;
  if (r < -0.005) return `−${body}`;
  return "0.00";
}

/* ── Column list row ───────────────────────────────────────────────── */

function Sparkbars({ counts, max }: { counts: number[]; max: number }) {
  const n = counts.length || 1;
  const w = 100 / n;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden="true">
      {counts.map((c, i) => {
        const h = max > 0 ? (c / max) * 22 : 0;
        return (
          <rect
            key={i}
            x={i * w + w * 0.14}
            y={23 - h}
            width={w * 0.72}
            height={Math.max(0.6, h)}
            className="fill-current"
          />
        );
      })}
    </svg>
  );
}

function ColumnRow({
  column,
  active,
  onSelect,
}: {
  column: ProfiledColumn;
  active: boolean;
  onSelect: () => void;
}) {
  const isTarget = column.role === "target";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors duration-200 ${
        active
          ? "border-neutral-900 bg-neutral-100/80 dark:border-white dark:bg-white/[0.055]"
          : "border-transparent hover:bg-neutral-50 dark:hover:bg-white/[0.025]"
      }`}
    >
      <span
        className={`shrink-0 rounded border px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.12em] ${
          column.type === "num"
            ? "border-neutral-300 text-neutral-500 dark:border-white/15 dark:text-zinc-400"
            : "border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-400"
        }`}
      >
        {column.type}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`truncate font-mono text-[11.5px] ${
              active ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-zinc-400"
            }`}
          >
            {column.name}
          </span>
          {isTarget ? <Target size={11} className="shrink-0 text-neutral-900 dark:text-white" /> : null}
        </span>
        {column.nullPct > 0 ? (
          <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-neutral-400 dark:text-zinc-600">
            <Warning size={9} />
            {column.nullPct.toFixed(1)}% null
          </span>
        ) : null}
      </span>

      <span
        className={`w-16 shrink-0 transition-opacity duration-200 ${
          active ? "text-neutral-900 dark:text-white" : "text-neutral-300 group-hover:text-neutral-400 dark:text-white/20 dark:group-hover:text-white/35"
        }`}
      >
        <Sparkbars counts={column.histogram.counts} max={column.histogram.max} />
      </span>
    </button>
  );
}

/* ── Distribution detail ───────────────────────────────────────────── */

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-neutral-200 pt-2 dark:border-white/[0.07]">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600">{label}</dt>
      <dd className="mt-1 font-mono text-[12.5px] tabular-nums text-neutral-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function NumericDetail({ column }: { column: ProfiledColumn }) {
  const { stats, histogram: hist, unit } = column;
  const span = stats.max - stats.min || 1;
  const pct = (v: number) => ((v - stats.min) / span) * 100;
  const n = hist.counts.length || 1;
  const w = 100 / n;

  return (
    <>
      <div className="relative h-40">
        {/* IQR band — the middle half of the distribution */}
        <div
          className="absolute inset-y-0 bg-neutral-900/[0.045] dark:bg-white/[0.055]"
          style={{ left: `${pct(stats.q1)}%`, width: `${pct(stats.q3) - pct(stats.q1)}%` }}
          aria-hidden="true"
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {hist.counts.map((c, i) => {
            const h = hist.max > 0 ? (c / hist.max) * 97 : 0;
            return (
              <rect
                key={i}
                x={i * w + w * 0.1}
                y={100 - h}
                width={w * 0.8}
                height={Math.max(0.4, h)}
                className="nf-hist-bar fill-neutral-900/85 dark:fill-white/80"
                style={{ animation: `nf-bar-rise 620ms cubic-bezier(0.16,1,0.3,1) ${i * 22}ms both` }}
              />
            );
          })}
        </svg>
        {/* Median rule */}
        <div
          className="absolute inset-y-0 w-px bg-neutral-900 dark:bg-white"
          style={{ left: `${pct(stats.median)}%` }}
          aria-hidden="true"
        >
          <span className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.16em] text-neutral-500 dark:text-zinc-400">
            median
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 font-mono text-[9.5px] tabular-nums text-neutral-400 dark:border-white/[0.07] dark:text-zinc-600">
        <span>{fmtNum(stats.min, unit)}</span>
        <span className="uppercase tracking-[0.18em]">{n} bins</span>
        <span>{fmtNum(stats.max, unit)}</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <StatCell label="mean" value={fmtNum(stats.mean, unit)} />
        <StatCell label="median" value={fmtNum(stats.median, unit)} />
        <StatCell label="std dev" value={fmtNum(stats.std, unit)} />
        <StatCell label="count" value={stats.n.toLocaleString("en-US")} />
        <StatCell label="q1" value={fmtNum(stats.q1, unit)} />
        <StatCell label="q3" value={fmtNum(stats.q3, unit)} />
        <StatCell label="iqr" value={fmtNum(stats.q3 - stats.q1, unit)} />
        <StatCell label="outliers" value={`${stats.outliers} · ${((stats.outliers / Math.max(1, stats.n)) * 100).toFixed(1)}%`} />
      </dl>

      <p className="mt-4 text-[11.5px] leading-relaxed text-neutral-400 dark:text-zinc-500">
        {stats.outliers > 0
          ? `${stats.outliers} value${stats.outliers === 1 ? "" : "s"} fall outside the 1.5 × IQR fence — flagged, not dropped.`
          : "No values fall outside the 1.5 × IQR fence."}{" "}
        {stats.mean > stats.median * 1.05
          ? "Mean sits above the median, so the tail leans right."
          : stats.median > stats.mean * 1.05
            ? "Median sits above the mean, so the tail leans left."
            : "Mean and median agree — the distribution is close to symmetric."}
      </p>
    </>
  );
}

function CategoricalDetail({ column, rows }: { column: ProfiledColumn; rows: number }) {
  const levels = column.categories ?? [];
  const counts = column.levelCounts ?? [];
  const max = Math.max(1, ...counts);

  return (
    <>
      <ul className="space-y-3">
        {levels.map((level, i) => {
          const count = counts[i] ?? 0;
          return (
            <li key={level}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-[11.5px] text-neutral-700 dark:text-zinc-300">{level}</span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-neutral-400 dark:text-zinc-500">
                  {count.toLocaleString("en-US")}
                  <span className="text-neutral-300 dark:text-zinc-700"> · </span>
                  {((count / rows) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                <div
                  className="nf-grow-l h-full rounded-full bg-neutral-900 dark:bg-white"
                  style={{
                    width: `${(count / max) * 100}%`,
                    animation: `nf-bar-grow 720ms cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="mt-6 grid grid-cols-3 gap-x-6 gap-y-3">
        <StatCell label="levels" value={String(levels.length)} />
        <StatCell label="mode" value={levels[counts.indexOf(max)] ?? "—"} />
        <StatCell label="null" value={`${column.nullPct.toFixed(1)}%`} />
      </dl>

      <p className="mt-4 text-[11.5px] leading-relaxed text-neutral-400 dark:text-zinc-500">
        Encoded as ordinal indices 0–{levels.length - 1} for the correlation matrix, which is why its
        coefficients are attenuated relative to the numeric columns.
      </p>
    </>
  );
}

/* ── Correlation matrix ────────────────────────────────────────────── */

interface HoverCell {
  row: number;
  col: number;
}

function CorrelationGrid({
  profile,
  hover,
  setHover,
}: {
  profile: Profile;
  hover: HoverCell | null;
  setHover: (cell: HoverCell | null) => void;
}) {
  const n = profile.columns.length;
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[420px]">
        {/* Column index header */}
        <div className="flex pl-[124px]">
          {profile.columns.map((c, i) => (
            <span
              key={c.name}
              className={`flex-1 pb-1.5 text-center font-mono text-[9px] transition-colors ${
                hover?.col === i ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-zinc-600"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>

        {profile.columns.map((rowCol, row) => (
          <div key={rowCol.name} className="flex items-center">
            <span
              className={`w-[124px] shrink-0 truncate pr-3 text-right font-mono text-[10px] transition-colors ${
                hover?.row === row ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-zinc-600"
              }`}
            >
              <span className="mr-1.5 opacity-50">{row + 1}</span>
              {rowCol.name}
            </span>

            {profile.columns.map((colCol, col) => {
              const r = profile.corr[row][col];
              const mag = Math.min(1, Math.abs(r));
              const positive = r >= 0;
              const isHover = hover?.row === row && hover?.col === col;
              // Size encodes magnitude; solid fill vs. hollow ring encodes sign.
              const size = 20 + mag * 66;
              return (
                <button
                  key={colCol.name}
                  type="button"
                  onMouseEnter={() => setHover({ row, col })}
                  onFocus={() => setHover({ row, col })}
                  onMouseLeave={() => setHover(null)}
                  onBlur={() => setHover(null)}
                  aria-label={`${rowCol.name} versus ${colCol.name}, r equals ${r.toFixed(2)}`}
                  className={`group relative flex aspect-square flex-1 items-center justify-center transition-colors duration-150 ${
                    isHover ? "bg-neutral-100 dark:bg-white/[0.07]" : "hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`block rounded-[2px] transition-transform duration-200 group-hover:scale-110 ${
                      positive
                        ? "bg-neutral-900 dark:bg-white"
                        : "border border-neutral-900 dark:border-white"
                    }`}
                    style={{
                      width: `${size}%`,
                      height: `${size}%`,
                      opacity: 0.22 + mag * 0.78,
                    }}
                  />
                </button>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-200 pt-3 pl-[124px] dark:border-white/[0.07]">
          <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-neutral-900 dark:bg-white" /> positive
          </span>
          <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-neutral-900 dark:border-white" /> negative
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
            area ∝ |r| · {n}×{n} pearson
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────── */

type BuiltProfile = { profile: Profile; ms: number };

// Profiles are immutable and deterministic, so they can be shared by every
// instance and retained across tab switches without involving a render-time ref.
const profileCache = new Map<string, BuiltProfile>();

export function DataProfiler() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.12 });
  const [specIdx, setSpecIdx] = useState(0);
  const [colIdx, setColIdx] = useState(0);
  const [hover, setHover] = useState<HoverCell | null>(null);
  const [built, setBuilt] = useState<BuiltProfile | null>(null);

  const spec = PROFILE_SPECS[specIdx];

  useEffect(() => {
    if (!inView) return;

    // Defer profiling out of render. Besides keeping render pure, this lets the
    // loading skeleton paint before a dataset is generated for the first time.
    const timer = window.setTimeout(() => {
      const hit = profileCache.get(spec.id);
      if (hit) {
        setBuilt(hit);
        return;
      }

      const t0 = performance.now();
      const profile = buildProfile(spec);
      const entry = { profile, ms: performance.now() - t0 };
      profileCache.set(spec.id, entry);
      setBuilt(entry);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [inView, spec]);

  // A previous tab's result remains in state until the effect runs; do not show
  // it under the newly selected tab's heading during that short interval.
  const current = built?.profile.id === spec.id ? built : null;
  const profile = current?.profile ?? null;
  const column = profile?.columns[Math.min(colIdx, profile.columns.length - 1)] ?? null;
  const targetCorrs = useMemo(() => (profile ? topTargetCorrelations(profile, 4) : []), [profile]);

  const hoveredR =
    profile && hover ? profile.corr[hover.row][hover.col] : null;

  return (
    <section id="data-lab" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="02"
          kicker="Data lab"
          title={
            <>
              Understand the data{" "}
              <span className="text-neutral-400 dark:text-zinc-500">before you model it.</span>
            </>
          }
          copy="Drop in a file and Datlify profiles every column: distributions, missingness, outlier fences and the full correlation structure. Pick a column, hover the matrix — these numbers are computed in your browser, right now."
        />

        <Reveal>
          <div ref={ref} className="relative mx-auto max-w-6xl">
            <span className="pointer-events-none absolute -left-3 -top-3 hidden h-8 w-8 border-l border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -right-3 -top-3 hidden h-8 w-8 border-r border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -left-3 hidden h-8 w-8 border-b border-l border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -right-3 hidden h-8 w-8 border-b border-r border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_60px_120px_-60px_rgba(0,0,0,0.3)] dark:border-white/10 dark:bg-[#070709] dark:shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
              {/* Dataset tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-5">
                <div className="flex items-center gap-1">
                  <Table size={13} className="mr-2 shrink-0 text-neutral-400 dark:text-zinc-500" />
                  {PROFILE_SPECS.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSpecIdx(i);
                        setColIdx(0);
                        setHover(null);
                      }}
                      className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] transition-colors duration-200 ${
                        i === specIdx
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                      }`}
                    >
                      {s.file}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">
                  {profile ? `profiled in ${current?.ms.toFixed(1)} ms` : "profiling…"}
                </span>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-2 gap-px border-b border-neutral-200 bg-neutral-200 sm:grid-cols-5 dark:border-white/[0.07] dark:bg-white/[0.07]">
                {[
                  { label: "rows", value: profile ? profile.rows.toLocaleString("en-US") : "—" },
                  { label: "columns", value: profile ? String(profile.columns.length) : "—" },
                  { label: "missing cells", value: profile ? profile.missingCells.toLocaleString("en-US") : "—" },
                  { label: "in memory", value: profile ? `${profile.memoryKb} KB` : "—" },
                  { label: "task", value: profile ? profile.task : "—" },
                ].map((cell) => (
                  <div key={cell.label} className="bg-white px-4 py-3 dark:bg-[#070709]">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600">{cell.label}</p>
                    <p className="mt-1 truncate font-mono text-[12.5px] tabular-nums text-neutral-900 dark:text-zinc-100">{cell.value}</p>
                  </div>
                ))}
              </div>

              {/* Columns + detail */}
              <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
                <div className="max-h-[420px] overflow-y-auto border-b border-neutral-200 py-2 scroll-thin lg:border-b-0 lg:border-r dark:border-white/[0.07]">
                  {profile ? (
                    profile.columns.map((c, i) => (
                      <ColumnRow key={c.name} column={c} active={i === colIdx} onSelect={() => setColIdx(i)} />
                    ))
                  ) : (
                    <div className="space-y-2 px-4 py-2">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="h-9 animate-pulse rounded bg-neutral-100 dark:bg-white/[0.04]" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-7" key={`${spec.id}-${colIdx}`}>
                  {column && profile ? (
                    <>
                      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-mono text-[15px] text-neutral-900 dark:text-white">{column.name}</h3>
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">
                          {column.role === "target" ? "target · " : ""}
                          {column.type === "num" ? "numeric" : "categorical"}
                          {column.unit ? ` · ${column.unit}` : ""}
                        </span>
                      </div>
                      {column.type === "num" ? (
                        <NumericDetail column={column} />
                      ) : (
                        <CategoricalDetail column={column} rows={profile.rows} />
                      )}
                    </>
                  ) : (
                    <div className="h-56 animate-pulse rounded-lg bg-neutral-100 dark:bg-white/[0.04]" />
                  )}
                </div>
              </div>

              {/* Correlation + target ranking */}
              <div className="grid border-t border-neutral-200 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] dark:border-white/[0.07]">
                <div className="border-b border-neutral-200 p-5 sm:p-7 lg:border-b-0 lg:border-r dark:border-white/[0.07]">
                  <div className="mb-4 flex items-baseline justify-between gap-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                      Correlation matrix
                    </h3>
                    <span className="font-mono text-[10px] tabular-nums text-neutral-400 dark:text-zinc-600">
                      {profile && hover && hoveredR !== null ? (
                        <>
                          <span className="text-neutral-700 dark:text-zinc-300">
                            {profile.columns[hover.row].name}
                          </span>
                          <span className="mx-1.5 opacity-40">×</span>
                          <span className="text-neutral-700 dark:text-zinc-300">
                            {profile.columns[hover.col].name}
                          </span>
                          <span className="mx-2 opacity-30">|</span>
                          <span className="text-neutral-900 dark:text-white">r = {fmtR(hoveredR)}</span>
                        </>
                      ) : (
                        "hover a cell"
                      )}
                    </span>
                  </div>
                  {profile ? (
                    <CorrelationGrid profile={profile} hover={hover} setHover={setHover} />
                  ) : (
                    <div className="h-64 animate-pulse rounded-lg bg-neutral-100 dark:bg-white/[0.04]" />
                  )}
                </div>

                <div className="p-5 sm:p-7">
                  <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                    Strongest signal
                  </h3>
                  <p className="mb-5 font-mono text-[10px] text-neutral-400 dark:text-zinc-600">
                    vs. <span className="text-neutral-700 dark:text-zinc-300">{profile?.target ?? "—"}</span>
                  </p>

                  <ul className="space-y-4">
                    {targetCorrs.map((c, i) => (
                      <li key={c.name}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="truncate font-mono text-[11px] text-neutral-600 dark:text-zinc-400">{c.name}</span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-900 dark:text-white">
                            {fmtR(c.r)}
                          </span>
                        </div>
                        {/* Zero-centred bar: left of centre is negative, right is positive. */}
                        <div className="relative h-1.5 bg-neutral-100 dark:bg-white/[0.06]">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-300 dark:bg-white/20" />
                          <span
                            className={`absolute inset-y-0 ${c.r >= 0 ? "left-1/2 nf-grow-l" : "right-1/2 nf-grow-r"} ${
                              c.r >= 0 ? "bg-neutral-900 dark:bg-white" : "border border-neutral-900 dark:border-white"
                            }`}
                            style={{
                              width: `${Math.min(50, Math.abs(c.r) * 50)}%`,
                              animation: `nf-bar-grow 700ms cubic-bezier(0.16,1,0.3,1) ${i * 80}ms both`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                    {targetCorrs.length === 0
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <li key={i} className="h-8 animate-pulse rounded bg-neutral-100 dark:bg-white/[0.04]" />
                        ))
                      : null}
                  </ul>

                  <p className="mt-6 border-t border-neutral-200 pt-4 text-[11.5px] leading-relaxed text-neutral-400 dark:border-white/[0.07] dark:text-zinc-500">
                    Ranked by |r| over pairwise-complete rows. Datlify surfaces these before you pick a model, so
                    leakage and dead columns show up in seconds instead of after a training run.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default DataProfiler;
