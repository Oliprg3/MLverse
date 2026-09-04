/**
 * chartCatalog.ts — the single source of truth for "which charts exist".
 *
 * The canvas Visualization nodes draw their checkbox lists from this catalog,
 * the Inspector renders it, the Results drawer titles/sizes each figure from
 * it, and the execution engines (Python `chart_library.py` + the TypeScript
 * fallback) key their figure builders on the same strings.
 *
 * Nothing is computed unless the user ticks it — that keeps a run fast and the
 * dashboard free of charts nobody asked for.
 */

import type { ChartGroup, ChartKey } from "./types";

export interface ChartGroupConfig {
  id: ChartGroup;
  label: string;
  accent: string;
  description: string;
}

export const CHART_GROUPS: Record<ChartGroup, ChartGroupConfig> = {
  core: { id: "core", label: "Evaluation", accent: "#0ea5e9", description: "How well did it classify?" },
  scatter: { id: "scatter", label: "Scatter & Geometry", accent: "#ec4899", description: "Where do the samples sit in feature space?" },
  knn: { id: "knn", label: "KNN Analysis", accent: "#f59e0b", description: "Neighbourhood structure: needs a KNN model." },
  diagnostics: { id: "diagnostics", label: "Diagnostics", accent: "#8b5cf6", description: "Is the model trustworthy / well-fit?" },
};

export interface ChartSpec {
  key: ChartKey;
  /** Card heading in the results grid. */
  label: string;
  /** Compact label for chips / checkboxes. */
  short: string;
  subtitle: string;
  group: ChartGroup;
  /** Grid columns to occupy (2 = full width). */
  span?: 1 | 2;
  /** Card body height in px. */
  height?: number;
  /** Requirement hint shown next to the checkbox. */
  requires?: string;
  /** Charts that take noticeably longer to compute. */
  slow?: boolean;
  /** Points carry a `customdata` sample index → clicking cross-filters the table. */
  selectable?: boolean;
}

export const CHART_CATALOG: ChartSpec[] = [
  /* ── Evaluation ─────────────────────────────────────────────────────── */
  { key: "confusion_matrix", label: "Confusion Matrix", short: "Confusion matrix", subtitle: "Counts + row-normalised share per true/predicted class", group: "core" },
  { key: "roc_curve", label: "ROC Curve", short: "ROC curve", subtitle: "Per-class one-vs-rest + macro average", group: "core" },
  { key: "pr_curve", label: "Precision-Recall Curve", short: "Precision-recall curve", subtitle: "Per-class + micro average, better than ROC when classes are imbalanced", group: "core" },
  { key: "feature_importance", label: "Feature Importance", short: "Feature importance", subtitle: "Top contributing features (native, coefficient, or permutation)", group: "core" },
  { key: "per_class_metrics", label: "Per-class Metrics", short: "Per-class metrics", subtitle: "Precision / recall / F1 side by side for every class", group: "core" },
  { key: "threshold_curve", label: "Threshold Sweep", short: "Threshold sweep", subtitle: "Precision, recall and F1 as the decision threshold moves", group: "core", requires: "binary target" },

  /* ── Scatter & geometry ─────────────────────────────────────────────── */
  { key: "scatter_2d", label: "2D Scatter", short: "2D scatter", subtitle: "Test samples in 2D, misclassified points marked with ✕", group: "scatter", selectable: true },
  { key: "scatter_3d", label: "3D Scatter", short: "3D scatter (rotatable)", subtitle: "Drag to orbit, three components coloured by true class", group: "scatter", height: 420, requires: "≥3 features", selectable: true },
  { key: "splom", label: "Scatter Matrix", short: "Scatter matrix (pair plot)", subtitle: "Every pairwise feature combination, coloured by class", group: "scatter", span: 2, height: 520 },
  { key: "decision_boundary", label: "Decision Boundary", short: "Decision boundary", subtitle: "The model refit in 2D, showing regions it assigns to each class", group: "scatter", height: 400, slow: true },
  { key: "embedding", label: "t-SNE Embedding", short: "t-SNE embedding", subtitle: "Non-linear 2D map revealing clusters PCA flattens", group: "scatter", height: 400, slow: true, selectable: true },
  { key: "confidence_scatter", label: "Confidence vs Margin", short: "Confidence / margin scatter", subtitle: "Where the model hesitates: low margin points are the risky ones", group: "scatter", selectable: true },

  /* ── KNN analysis ───────────────────────────────────────────────────── */
  { key: "knn_k_sweep", label: "k Sweep (elbow)", short: "k sweep / elbow curve", subtitle: "Accuracy across k for uniform vs distance weighting, the best k starred", group: "knn", height: 360, requires: "KNN model", slow: true },
  { key: "knn_boundary", label: "KNN Decision Regions", short: "KNN decision regions", subtitle: "Neighbourhood vote regions in 2D with the training points that create them", group: "knn", height: 400, requires: "KNN model" },
  { key: "knn_neighbor_graph", label: "Neighbour Links", short: "Neighbour link graph", subtitle: "Probe samples joined to each of their k nearest training neighbours", group: "knn", span: 2, height: 480, requires: "KNN model", selectable: true },
  { key: "knn_distance_hist", label: "Neighbour Distance", short: "Neighbour distance histogram", subtitle: "Distance to the k-th neighbour: far points are the ones KNN gets wrong", group: "knn", requires: "KNN model" },
  { key: "knn_vote_scatter", label: "Vote Share vs Distance", short: "Vote share scatter", subtitle: "Neighbour agreement against mean neighbour distance, split by correctness", group: "knn", requires: "KNN model", selectable: true },

  /* ── Diagnostics ────────────────────────────────────────────────────── */
  { key: "learning_curve", label: "Learning Curve", short: "Learning curve", subtitle: "Train vs validation accuracy as data grows, diagnoses over/underfitting", group: "diagnostics", height: 360, slow: true },
  { key: "cv_scores", label: "Cross-validation Spread", short: "Cross-validation spread", subtitle: "Per-fold accuracy: a wide box means an unstable model", group: "diagnostics", slow: true },
  { key: "calibration", label: "Calibration Curve", short: "Calibration curve", subtitle: "Predicted probability vs observed frequency: is 80% really 80%?", group: "diagnostics" },
  { key: "class_balance", label: "Class Balance", short: "Class balance", subtitle: "Train / test / predicted counts per class", group: "diagnostics" },
  { key: "correlation", label: "Feature Correlation", short: "Feature correlation", subtitle: "Pearson correlation between the most important features", group: "diagnostics", height: 400 },
  /* ── Deep learning ──────────────────────────────────────────────────── */
  { key: "training_history", label: "Training History", short: "Training history", subtitle: "Train loss vs validation accuracy per epoch — watch the loss fall and the model learn", group: "diagnostics", height: 360 },
];

const BY_KEY = new Map(CHART_CATALOG.map((c) => [c.key, c]));
const ORDER = new Map(CHART_CATALOG.map((c, i) => [c.key, i]));

export function chartSpec(key: string): ChartSpec | undefined {
  return BY_KEY.get(key as ChartKey);
}

export function chartsInGroup(group: ChartGroup): ChartSpec[] {
  return CHART_CATALOG.filter((c) => c.group === group);
}

/** Catalog order, so grids and chip rows stay stable between runs. */
export function sortChartKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => (ORDER.get(a as ChartKey) ?? 99) - (ORDER.get(b as ChartKey) ?? 99));
}

export function isChartKey(value: string): value is ChartKey {
  return BY_KEY.has(value as ChartKey);
}

/** Chart selections travel as a comma-separated string inside a NodeParam. */
export function parseChartSelection(value: string | number | undefined): ChartKey[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(isChartKey);
}

export function serializeChartSelection(keys: string[]): string {
  return sortChartKeys(Array.from(new Set(keys))).join(",");
}

/** The four figures the app produced before charts became selectable. */
export const DEFAULT_CHARTS: ChartKey[] = ["confusion_matrix", "roc_curve", "pr_curve", "feature_importance"];

/**
 * Union of every `charts` param across the graph's visualization nodes.
 * Empty selection (or no visualization node at all) → the classic four.
 */
export function collectRequestedCharts(
  nodes: { params?: Record<string, string | number> | undefined }[],
): ChartKey[] {
  const keys = new Set<ChartKey>();
  let sawVizNode = false;
  for (const node of nodes) {
    const raw = node.params?.charts;
    if (raw === undefined) continue;
    sawVizNode = true;
    parseChartSelection(raw).forEach((k) => keys.add(k));
  }
  if (!sawVizNode) return [...DEFAULT_CHARTS];
  return sortChartKeys([...keys]) as ChartKey[];
}
