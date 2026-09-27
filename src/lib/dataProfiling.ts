/**
 * dataProfiling.ts — comprehensive per-dataset analysis, client-side.
 *
 * Profiles a CSV (dtypes, missingness, cardinality, numeric moments, top
 * categories, target class balance, duplicates) and an image dataset (class
 * distribution). Purely computed on the front-end so the "Analyze" step works
 * the moment a dataset lands on a data node — before anything is connected.
 */

import Papa from "papaparse";

import type { CsvDataset, ImageDataset } from "./types";

const MISSING = new Set(["", "?", "na", "n/a", "null", "nan", "none", "-"]);

export type ColumnDtype = "numeric" | "categorical" | "boolean" | "text";

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  zeros: number;
}

export interface CategoryBucket {
  value: string;
  count: number;
  pct: number;
}

export interface ColumnProfile {
  name: string;
  dtype: ColumnDtype;
  missing: number;
  missingPct: number;
  uniques: number;
  /** Present when dtype === "numeric". */
  numeric?: NumericStats;
  /** Present when dtype is categorical or boolean — most frequent values. */
  top?: CategoryBucket[];
}

export interface CsvProfile {
  fileName: string;
  nrows: number;
  ncols: number;
  targetColumn: string;
  missingTotal: number;
  missingPct: number;
  duplicateRows: number;
  columns: ColumnProfile[];
  classBalance: CategoryBucket[];
}

export interface ImageProfile {
  nsamples: number;
  width: number;
  height: number;
  nclasses: number;
  classBalance: CategoryBucket[];
}

export interface CsvPreview {
  columns: string[];
  rows: string[][];
}

/**
 * Cheap slice of a CSV for on-node preview: parses only the leading chunk of
 * the sheet (constant work regardless of file size) and caps the visible grid.
 */
export function csvPreview(csv: CsvDataset, maxRows = 4, maxCols = 5): CsvPreview {
  const slice = csv.csvText.slice(0, 8_000);
  const parsed = Papa.parse<string[]>(slice.trim(), { skipEmptyLines: true });
  const table = (parsed.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
  if (table.length === 0) return { columns: [], rows: [] };
  const columns = table[0].map((h) => h.trim()).slice(0, maxCols);
  const rows = table.slice(1, 1 + maxRows).map((row) =>
    columns.map((_, i) => (row[i] ?? "").trim()),
  );
  return { columns, rows };
}

/** Report only the first N columns so wide sheets stay readable in the sheet. */
const MAX_COLUMNS_REPORT = 24;
const MAX_TOP = 4;
const MAX_CLASS_BUCKETS = 10;
const SAMPLE_ROWS = 10_000;

function isMissing(raw: string): boolean {
  return MISSING.has(raw.trim().toLowerCase());
}

function classify(values: string[]): { dtype: ColumnDtype; numeric?: NumericStats } {
  const clean = values.filter((v) => !isMissing(v));
  if (clean.length === 0) return { dtype: "text" };

  const numeric = clean.filter((v) => v !== "" && !Number.isNaN(Number(v)));
  const numericRatio = numeric.length / clean.length;

  // Boolean when every value is a truthy token.
  const boolSet = new Set(clean.map((v) => v.trim().toLowerCase()));
  if (boolSet.size <= 2 && [...boolSet].every((v) => ["true", "false", "0", "1", "yes", "no", "y", "n"].includes(v))) {
    const parsed = clean.map(Number).filter((v) => !Number.isNaN(v));
    const counts = parsed.filter((v) => v === 0).length;
    return {
      dtype: "boolean",
      numeric: {
        min: parsed.length ? Math.min(...parsed) : 0,
        max: parsed.length ? Math.max(...parsed) : 0,
        mean: parsed.length ? parsed.reduce((a, b) => a + b, 0) / parsed.length : 0,
        median: medianOf(parsed),
        std: stdOf(parsed),
        zeros: counts,
      },
    };
  }

  if (numericRatio >= 0.9 && numeric.length > 0) {
    const parsed = numeric.map(Number);
    return {
      dtype: "numeric",
      numeric: {
        min: Math.min(...parsed),
        max: Math.max(...parsed),
        mean: parsed.reduce((a, b) => a + b, 0) / parsed.length,
        median: medianOf(parsed),
        std: stdOf(parsed),
        zeros: parsed.filter((v) => v === 0).length,
      },
    };
  }

  const unique = new Set(clean.map((v) => v.trim().toLowerCase()));
  if (unique.size <= Math.max(15, clean.length * 0.2)) return { dtype: "categorical" };
  return { dtype: "text" };
}

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1));
}

function topBuckets(values: string[], max: number): CategoryBucket[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = isMissing(v) ? "(missing)" : v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = values.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([value, count]) => ({ value, count, pct: (count / total) * 100 }));
}

/** Full statistical profile of a CSV dataset (sampled for very large sheets). */
export function profileCsv(csv: CsvDataset): CsvProfile {
  const parsed = Papa.parse<Record<string, string>>(csv.csvText.trim(), { header: true, skipEmptyLines: true });
  const columns = (parsed.meta.fields ?? []).filter(Boolean);
  const rows = parsed.data.slice(0, SAMPLE_ROWS);
  const targetIdx = columns.indexOf(csv.targetColumn);

  const columnProfiles: ColumnProfile[] = columns.slice(0, MAX_COLUMNS_REPORT).map((col) => {
    const idx = columns.indexOf(col);
    const values = rows.map((r) => r[col] ?? "").slice();
    const missing = values.filter((v) => isMissing(v)).length;
    const { dtype, numeric } = classify(values);
    const nonMissing = values.filter((v) => !isMissing(v));
    const uniques = new Set(nonMissing.map((v) => v.trim().toLowerCase())).size;
    const top = dtype === "numeric" ? undefined : topBuckets(values, MAX_TOP);
    return { name: col, dtype, missing, missingPct: values.length ? (missing / values.length) * 100 : 0, uniques, numeric, top };
  });

  let missingTotal = 0;
  for (const col of columnProfiles) missingTotal += col.missing;

  const targetValues = targetIdx >= 0 ? rows.map((r) => r[columns[targetIdx]] ?? "") : [];
  const classBalance = topBuckets(targetValues, MAX_CLASS_BUCKETS);

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = columns.map((c) => row[c] ?? "").join("\u0001");
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }

  const sampled = rows.length;
  return {
    fileName: csv.filename,
    nrows: csv.nrows,
    ncols: columns.length,
    targetColumn: csv.targetColumn,
    missingTotal,
    missingPct: sampled ? (missingTotal / (sampled * columns.length)) * 100 : 0,
    duplicateRows,
    columns: columnProfiles,
    classBalance,
  };
}

/** Class distribution + shape facts for an image dataset. */
export function profileImages(images: ImageDataset): ImageProfile {
  const buckets: CategoryBucket[] = images.classNames.map((name, ci) => {
    const count = images.labels.filter((l) => l === ci).length;
    return { value: name, count, pct: images.nsamples ? (count / images.nsamples) * 100 : 0 };
  });
  return {
    nsamples: images.nsamples,
    width: images.width,
    height: images.height,
    nclasses: images.classNames.length,
    classBalance: buckets.sort((a, b) => b.count - a.count),
  };
}