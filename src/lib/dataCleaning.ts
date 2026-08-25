/**
 * dataCleaning.ts — client-side CSV quality analysis + one-click cleaning.
 *
 * `analyzeCsv` detects quality issues (missing cells, text in numeric
 * columns, duplicate rows, constant columns). `buildCleaningPlan` turns the
 * analysis into per-column fill strategies with a preview of the exact
 * replacements, and `applyCleaning` rewrites the CSV text.
 */

import Papa from "papaparse";

import type { CsvDataset } from "./types";

export type ColumnIssue =
  | { kind: "missing"; column: string; count: number }
  | { kind: "text"; column: string; count: number; samples: string[] }
  | { kind: "constant"; column: string };

export interface CsvIssues {
  missingTotal: number;
  duplicateRows: number;
  columns: ColumnIssue[];
  /** Columns that had at least one problem — these get cleaning strategies. */
  affected: string[];
}

export type CleanStrategy = "mean" | "median" | "mode" | "zero" | "drop";

export const STRATEGY_LABEL: Record<CleanStrategy, string> = {
  mean: "Mean (average)",
  median: "Median (middle value)",
  mode: "Most frequent",
  zero: "Zero",
  drop: "Drop those rows",
};

export interface Replacement {
  rowIndex: number;
  column: string;
  from: string;
  to: string;
  strategy: CleanStrategy;
}

export interface CleaningPlan {
  strategies: Record<string, CleanStrategy>;
  /** Every replacement that would be applied (capped for the preview). */
  preview: Replacement[];
  totalReplacements: number;
  rowsDropped: number;
}

const MISSING = new Set(["", "?", "na", "n/a", "null", "nan", "none", "-"]);
function isMissing(raw: string): boolean {
  return MISSING.has(raw.trim().toLowerCase());
}

interface ParsedCsv {
  columns: string[];
  rows: string[][];
}

export function parseCsvLoose(text: string): ParsedCsv {
  // Papa handles RFC-4180 quoting — commas inside quoted fields ("Braund, Mr.
  // Owen Harris") must not split cells, which naive string splitting gets wrong.
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const table = (parsed.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
  if (table.length === 0) return { columns: [], rows: [] };
  const columns = table[0].map((h) => h.trim());
  const rows = table.slice(1).map((row) => columns.map((_, i) => (row[i] ?? "").trim()));
  return { columns, rows };
}

/** Scan the dataset for quality issues (samples up to 5 000 rows for speed). */
export function analyzeCsv(csv: CsvDataset): CsvIssues {
  const { columns, rows } = parseCsvLoose(csv.csvText);
  const sample = rows.slice(0, 5000);
  const issues: ColumnIssue[] = [];
  const affected = new Set<string>();
  let missingTotal = 0;

  const colIndex = new Map(columns.map((c, i) => [c, i]));
  for (const column of columns) {
    if (column === csv.targetColumn) continue;
    const idx = colIndex.get(column)!;
    let missing = 0;
    let text = 0;
    const textSamples: string[] = [];
    const values: string[] = [];
    for (const row of sample) {
      const raw = (row[idx] ?? "").trim();
      values.push(raw);
      if (isMissing(raw)) {
        missing += 1;
        continue;
      }
      if (Number.isNaN(Number(raw))) {
        text += 1;
        if (textSamples.length < 3) textSamples.push(raw);
      }
    }
    if (missing > 0) {
      issues.push({ kind: "missing", column, count: missing });
      affected.add(column);
      missingTotal += missing;
    }
    if (text > 0) {
      issues.push({ kind: "text", column, count: text, samples: textSamples });
      affected.add(column);
    }
    const nonMissing = values.filter((v) => !isMissing(v));
    if (nonMissing.length > 1 && new Set(nonMissing).size === 1) {
      issues.push({ kind: "constant", column });
    }
  }

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of sample) {
    const key = row.join("\u0001");
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }

  return { missingTotal, duplicateRows, columns: issues, affected: [...affected] };
}

export function hasIssues(issues: CsvIssues): boolean {
  return issues.missingTotal > 0 || issues.duplicateRows > 0 || issues.columns.some((c) => c.kind === "text");
}

/** Default strategy per column: numeric → median, categorical → mode. */
export function defaultStrategy(csv: CsvDataset, column: string): CleanStrategy {
  const { columns, rows } = parseCsvLoose(csv.csvText);
  const idx = columns.indexOf(column);
  if (idx === -1) return "mode";
  const values = rows.slice(0, 500).map((r) => (r[idx] ?? "").trim()).filter((v) => !isMissing(v));
  const numeric = values.length > 0 && values.every((v) => !Number.isNaN(Number(v)));
  return numeric ? "median" : "mode";
}

function numericStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const mean = values.reduce((s, x) => s + x, 0) / (values.length || 1);
  return { mean, median };
}

function modeValue(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "";
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN || (n === bestN && v < best)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/**
 * Compute the full replacement list for a set of per-column strategies.
 * The preview is capped — `totalReplacements` holds the real count.
 */
export function buildCleaningPlan(csv: CsvDataset, strategies: Record<string, CleanStrategy>): CleaningPlan {
  const { columns, rows } = parseCsvLoose(csv.csvText);
  const colIndex = new Map(columns.map((c, i) => [c, i]));
  const preview: Replacement[] = [];
  let totalReplacements = 0;
  let rowsDropped = 0;

  const dropColumns = Object.entries(strategies).filter(([, s]) => s === "drop").map(([c]) => c);
  const fillColumns = Object.entries(strategies).filter(([c, s]) => s !== "drop" && columns.includes(c)) as Array<[string, Exclude<CleanStrategy, "drop">]>;

  // Pre-compute fill values per column from non-missing values.
  const fillValue = new Map<string, string>();
  for (const [column, strategy] of fillColumns) {
    const idx = colIndex.get(column)!;
    const raw = rows.map((r) => (r[idx] ?? "").trim());
    const present = raw.filter((v) => !isMissing(v));
    if (strategy === "mode") {
      fillValue.set(column, modeValue(present));
      continue;
    }
    const nums = present.map(Number).filter((n) => !Number.isNaN(n));
    if (strategy === "zero" || nums.length === 0) {
      fillValue.set(column, strategy === "zero" ? "0" : modeValue(present));
    } else {
      const { mean, median } = numericStats(nums);
      fillValue.set(column, String(Number((strategy === "mean" ? mean : median).toFixed(4))));
    }
  }

  const dropSet = new Set(dropColumns);
  rows.forEach((row, rowIndex) => {
    const missingInRow = columns.some((c, i) => dropSet.has(c) && isMissing((row[i] ?? "").trim()));
    if (missingInRow) {
      rowsDropped += 1;
      return;
    }
    for (const [column, strategy] of fillColumns) {
      const idx = colIndex.get(column)!;
      const raw = (row[idx] ?? "").trim();
      if (!isMissing(raw)) continue;
      const to = fillValue.get(column) ?? "";
      totalReplacements += 1;
      if (preview.length < 8) {
        preview.push({ rowIndex, column, from: raw === "" ? "(empty)" : raw, to, strategy });
      }
    }
  });

  return { strategies, preview, totalReplacements, rowsDropped };
}

/** Apply the plan and return a cleaned CsvDataset (original untouched). */
export function applyCleaning(csv: CsvDataset, strategies: Record<string, CleanStrategy>): { dataset: CsvDataset; replacements: number; rowsDropped: number } {
  const { columns, rows } = parseCsvLoose(csv.csvText);
  const colIndex = new Map(columns.map((c, i) => [c, i]));
  const plan = buildCleaningPlan(csv, strategies);

  const dropColumns = Object.entries(strategies).filter(([, s]) => s === "drop").map(([c]) => c);
  const dropSet = new Set(dropColumns);
  const fillColumns = Object.entries(strategies).filter(([c, s]) => s !== "drop" && columns.includes(c)) as Array<[string, Exclude<CleanStrategy, "drop">]>;

  const delimiter = csv.csvText.includes(";") && !csv.csvText.includes(",") ? ";" : ",";
  const outRows: string[][] = [];

  const fillValue = new Map<string, string>();
  for (const [column, strategy] of fillColumns) {
    const idx = colIndex.get(column)!;
    const present = rows.map((r) => (r[idx] ?? "").trim()).filter((v) => !isMissing(v));
    if (strategy === "mode") {
      fillValue.set(column, modeValue(present));
      continue;
    }
    const nums = present.map(Number).filter((n) => !Number.isNaN(n));
    if (strategy === "zero" || nums.length === 0) {
      fillValue.set(column, strategy === "zero" ? "0" : modeValue(present));
    } else {
      const { mean, median } = numericStats(nums);
      fillValue.set(column, String(Number((strategy === "mean" ? mean : median).toFixed(4))));
    }
  }

  for (const row of rows) {
    if (columns.some((c, i) => dropSet.has(c) && isMissing((row[i] ?? "").trim()))) continue;
    const next = row.slice();
    for (const [column] of fillColumns) {
      const idx = colIndex.get(column)!;
      if (isMissing((next[idx] ?? "").trim())) next[idx] = fillValue.get(column) ?? "";
    }
    outRows.push(next);
  }

  const csvText = [columns.join(delimiter), ...outRows.map((r) => r.join(delimiter))].join("\n");
  const summaryParts: string[] = [];
  if (plan.totalReplacements > 0) summaryParts.push(`${plan.totalReplacements} filled`);
  if (plan.rowsDropped > 0) summaryParts.push(`${plan.rowsDropped} rows dropped`);

  return {
    dataset: {
      ...csv,
      csvText,
      nrows: outRows.length,
    },
    replacements: plan.totalReplacements,
    rowsDropped: plan.rowsDropped,
  };
}

export type TextColumnAction = "drop" | "label" | "onehot";

/**
 * Resolve text columns that would poison a numeric pipeline, per the user's
 * explicit confirmation: drop the column, ordinal-encode it, or explode it
 * into 0/1 one-hot columns. Returns a rewritten CsvDataset (original untouched).
 */
export function applyTextColumnResolutions(
  csv: CsvDataset,
  decisions: Record<string, TextColumnAction>,
): { dataset: CsvDataset; dropped: string[]; encoded: string[]; added: number } {
  const { columns, rows } = parseCsvLoose(csv.csvText);
  const colIndex = new Map(columns.map((c, i) => [c, i]));

  const dropCols: string[] = [];
  const encodeCols: string[] = [];
  for (const [column, action] of Object.entries(decisions)) {
    if (!columns.includes(column) || column === csv.targetColumn) continue;
    if (action === "drop") dropCols.push(column);
    else encodeCols.push(column);
  }

  // One-hot columns are derived from the full row set up-front.
  const oneHotValues = new Map<string, string[]>();
  let addedColumns = 0;
  for (const column of encodeCols) {
    if (decisions[column] !== "onehot") continue;
    const idx = colIndex.get(column)!;
    const uniques = Array.from(new Set(rows.map((r) => (r[idx] ?? "").trim() || "(missing)")));
    oneHotValues.set(column, uniques);
    addedColumns += uniques.length;
  }

  const keptColumns = columns.filter((c) => !dropCols.includes(c) && c !== csv.targetColumn);
  const outColumns: string[] = [];
  const outColumnSources: Array<{ column: string; mode: "asis" | "label" | "onehot"; valueIndex?: number }> = [];
  for (const column of keptColumns) {
    if (encodeCols.includes(column) && decisions[column] === "onehot") {
      for (const value of oneHotValues.get(column) ?? []) {
        outColumns.push(`${column}_${value}`);
        outColumnSources.push({ column, mode: "onehot", valueIndex: (oneHotValues.get(column) ?? []).indexOf(value) });
      }
    } else if (encodeCols.includes(column) && decisions[column] === "label") {
      outColumns.push(column);
      outColumnSources.push({ column, mode: "label" });
    } else {
      outColumns.push(column);
      outColumnSources.push({ column, mode: "asis" });
    }
  }
  outColumns.push(csv.targetColumn);

  const labelMaps = new Map<string, Map<string, number>>();
  for (const column of encodeCols) {
    if (decisions[column] !== "label") continue;
    const idx = colIndex.get(column)!;
    const uniques = Array.from(new Set(rows.map((r) => (r[idx] ?? "").trim()))).sort();
    labelMaps.set(column, new Map(uniques.map((v, i) => [v, i])));
  }

  const targetIdx = colIndex.get(csv.targetColumn)!;
  const outRows = rows.map((row) =>
    outColumnSources.map((source) => {
      const raw = (row[colIndex.get(source.column)!] ?? "").trim();
      if (source.mode === "onehot") return raw === (oneHotValues.get(source.column) ?? [])[source.valueIndex ?? -1] ? "1" : "0";
      if (source.mode === "label") return String(labelMaps.get(source.column)?.get(raw) ?? 0);
      return raw;
    }).concat([(row[targetIdx] ?? "").trim()]),
  );

  const csvText = Papa.unparse({ fields: outColumns, data: outRows });
  const nextTarget = csv.targetColumn;
  return {
    dataset: {
      ...csv,
      columns: outColumns,
      targetColumn: nextTarget,
      nrows: outRows.length,
      csvText,
    },
    dropped: dropCols,
    encoded: encodeCols,
    added: addedColumns,
  };
}
