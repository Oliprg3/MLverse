/**
 * pipelineValidation.ts — client-side structural & type validation for the
 * visual pipeline graph.
 *
 * Runs on every canvas mutation (memoized) so problems surface while the user
 * is wiring nodes, long before the Python engine executes anything:
 *   - broken DAG paths (disconnected data/model/viz stages)
 *   - cycles
 *   - parameter bounds that cannot execute (PCA components > features, k >= n)
 *   - data-shape mismatches derived from the attached dataset metadata
 *   - CSV content inspection: text columns feeding numeric-only models,
 *     unhandled missing values
 */

import type { CsvDataset, GraphEdgePayload, GraphNodePayload, ImageDataset } from "./types";

export type DiagnosticLevel = "error" | "warning";

export interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  nodeId?: string;
  title: string;
  detail: string;
}

/** Known shapes of the built-in datasets. */
const BUILTIN_DATASETS: Record<string, { n_samples: number; n_features: number; n_classes: number }> = {
  "data:breast_cancer": { n_samples: 569, n_features: 30, n_classes: 2 },
  "data:wine": { n_samples: 178, n_features: 13, n_classes: 3 },
  "data:iris": { n_samples: 150, n_features: 4, n_classes: 3 },
};

interface DatasetFacts {
  nodeId: string;
  name: string;
  n_samples: number;
  n_features: number;
  csv?: CsvDataset;
  image?: ImageDataset;
  syntheticParams?: Record<string, string | number>;
}

function paramValue(params: Record<string, string | number> | undefined, key: string): string | number | undefined {
  return params?.[key];
}

/** Inspect a CSV sample to find text-only feature columns and missing cells. */
function inspectCsv(csv: CsvDataset): { textColumns: string[]; missingCells: number; sampledRows: number } {
  const rows = csv.csvText.split(/\r?\n/).filter((r) => r.trim().length > 0).slice(0, 51);
  if (rows.length === 0) return { textColumns: [], missingCells: 0, sampledRows: 0 };
  const delimiter = rows[0].includes(";") && !rows[0].includes(",") ? ";" : ",";
  const header = rows[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  const textColumns = new Set<string>();
  let missingCells = 0;
  let sampledRows = 0;
  for (const row of rows.slice(1)) {
    sampledRows += 1;
    const cells = row.split(delimiter);
    header.forEach((col, i) => {
      if (col === csv.targetColumn) return;
      const raw = (cells[i] ?? "").trim();
      if (raw === "" || raw === "?" || raw.toLowerCase() === "na" || raw.toLowerCase() === "null") {
        missingCells += 1;
        return;
      }
      if (Number.isNaN(Number(raw))) textColumns.add(col);
    });
  }
  return { textColumns: [...textColumns], missingCells, sampledRows };
}

export function validatePipeline(nodes: GraphNodePayload[], edges: GraphEdgePayload[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (nodes.length === 0) return diagnostics;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  const ancestorsOf = (startId: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [...(incoming.get(startId) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(incoming.get(id) ?? []));
    }
    return seen;
  };

  // ── Cycle detection ────────────────────────────────────────────────────────
  const state = new Map<string, 1 | 2>();
  const walk = (id: string, path: string[]) => {
    state.set(id, 1);
    for (const next of outgoing.get(id) ?? []) {
      if (state.get(next) === 1) {
        diagnostics.push({
          id: `cycle-${next}`,
          level: "error",
          nodeId: next,
          title: "Circular connection",
          detail: `“${byId.get(next)?.label ?? next}” is part of a loop. Data cannot flow in circles — remove one of the back-links.`,
        });
        return;
      }
      if (!state.has(next)) walk(next, [...path, id]);
    }
    state.set(id, 2);
  };
  for (const node of nodes) if (!state.has(node.id)) walk(node.id, []);

  // ── Stage coverage ─────────────────────────────────────────────────────────
  const dataNodes = nodes.filter((n) => n.category === "data");
  const modelNodes = nodes.filter((n) => n.category === "classic_ml" || n.category === "deep_learning");
  const vizNodes = nodes.filter((n) => n.category === "visualization");
  const preNodes = nodes.filter((n) => n.category === "preprocessing");

  if (dataNodes.length === 0) {
    diagnostics.push({ id: "no-data", level: "error", title: "No dataset", detail: "Add a data node — every pipeline starts with a data source." });
  } else if (dataNodes.length > 1) {
    diagnostics.push({
      id: "multi-data",
      level: "warning",
      nodeId: dataNodes[1].id,
      title: `${dataNodes.length} data sources`,
      detail: "Only one dataset is used per run. Disconnect the extra sources to avoid ambiguity.",
    });
  }

  if (modelNodes.length === 0) {
    diagnostics.push({ id: "no-model", level: "error", title: "No model", detail: "Add a classic-ML or deep-learning model node to train on." });
  }

  // ── Connectivity of each stage ─────────────────────────────────────────────
  const primaryData = dataNodes[0];
  for (const node of dataNodes) {
    if ((outgoing.get(node.id) ?? []).length === 0) {
      diagnostics.push({
        id: `data-dangling-${node.id}`,
        level: node === primaryData ? "error" : "warning",
        nodeId: node.id,
        title: "Dataset is not connected",
        detail: `“${node.label}” has no outgoing link — nothing consumes this data.`,
      });
    }
  }

  for (const node of preNodes) {
    if ((outgoing.get(node.id) ?? []).length === 0) {
      diagnostics.push({
        id: `pre-dangling-${node.id}`,
        level: "warning",
        nodeId: node.id,
        title: "Preprocessor is not connected",
        detail: `“${node.label}” output goes nowhere — chain it into the model.`,
      });
    }
  }

  for (const node of modelNodes) {
    const upstream = ancestorsOf(node.id);
    const fedByData = dataNodes.some((d) => upstream.has(d.id));
    if (!fedByData) {
      diagnostics.push({
        id: `model-orphan-${node.id}`,
        level: "error",
        nodeId: node.id,
        title: "Model has no training data",
        detail: `“${node.label}” is not reachable from any dataset. Connect a path from the data node.`,
      });
    }
  }

  for (const node of vizNodes) {
    const upstream = ancestorsOf(node.id);
    const fedByModel = modelNodes.some((m) => upstream.has(m.id));
    if (!fedByModel && modelNodes.length > 0) {
      diagnostics.push({
        id: `viz-orphan-${node.id}`,
        level: "warning",
        nodeId: node.id,
        title: "Visualization has no model",
        detail: `“${node.label}” will only produce data-level plots unless it sits downstream of a trained model.`,
      });
    }
    if ((incoming.get(node.id) ?? []).length === 0) {
      diagnostics.push({
        id: `viz-input-${node.id}`,
        level: "error",
        nodeId: node.id,
        title: "Visualization has no input",
        detail: `“${node.label}” needs an incoming connection to know what to plot.`,
      });
    }
  }

  // ── Dataset facts → shape-aware parameter checks ───────────────────────────
  const facts: DatasetFacts | null = primaryData
    ? {
      nodeId: primaryData.id,
      name: primaryData.dataset?.filename ?? primaryData.imageDataset?.name ?? primaryData.label,
      n_samples: primaryData.dataset?.nrows ?? primaryData.imageDataset?.nsamples
        ?? (primaryData.type === "data:synthetic" ? Number(paramValue(primaryData.params, "n_samples") ?? 1200) : BUILTIN_DATASETS[primaryData.type]?.n_samples ?? 0),
      n_features: primaryData.dataset ? Math.max(0, primaryData.dataset.columns.length - 1)
        : primaryData.imageDataset ? primaryData.imageDataset.width * primaryData.imageDataset.height
          : (primaryData.type === "data:synthetic" ? Number(paramValue(primaryData.params, "n_features") ?? 20) : BUILTIN_DATASETS[primaryData.type]?.n_features ?? 0),
      csv: primaryData.dataset,
      image: primaryData.imageDataset,
      syntheticParams: primaryData.type === "data:synthetic" ? primaryData.params : undefined,
    }
    : null;

  if (facts && primaryData) {
    for (const node of [...preNodes, ...modelNodes]) {
      const upstream = ancestorsOf(node.id);
      if (!upstream.has(primaryData.id)) continue;

      // PCA component bound check.
      if (node.type === "pre:pca") {
        const raw = paramValue(node.params, "n_components");
        const value = typeof raw === "string" ? Number(raw) : raw;
        if (typeof value === "number" && !Number.isNaN(value)) {
          if (value < 1 && value <= 0) {
            diagnostics.push({ id: `pca-${node.id}`, level: "error", nodeId: node.id, title: "Invalid PCA components", detail: "The fraction of variance must be greater than 0." });
          } else if (value >= 1 && facts.n_features > 0 && value > facts.n_features) {
            diagnostics.push({
              id: `pca-${node.id}`,
              level: "error",
              nodeId: node.id,
              title: "PCA exceeds feature count",
              detail: `n_components=${value} but “${facts.name}” only has ${facts.n_features} features. Lower it or use a variance fraction below 1.`,
            });
          }
        }
      }

      // KNN k vs sample count / class count.
      if (node.type === "ml:knn") {
        const k = Number(paramValue(node.params, "n_neighbors") ?? 5);
        if (facts.n_samples > 0 && k >= facts.n_samples) {
          diagnostics.push({
            id: `knn-${node.id}`,
            level: "error",
            nodeId: node.id,
            title: "k larger than the training set",
            detail: `n_neighbors=${k} but the dataset has only ${facts.n_samples} samples. Reduce k.`,
          });
        } else if (facts.n_samples > 0 && k > facts.n_samples * 0.5) {
          diagnostics.push({
            id: `knn-${node.id}`,
            level: "warning",
            nodeId: node.id,
            title: "Very large k",
            detail: `k=${k} covers over half of the ${facts.n_samples} samples — predictions will be heavily smoothed.`,
          });
        }
      }

      // Synthetic class sanity.
      if (facts.syntheticParams) {
        const nClasses = Number(facts.syntheticParams.n_classes ?? 2);
        const nSamples = Number(facts.syntheticParams.n_samples ?? 1200);
        if (nClasses > nSamples) {
          diagnostics.push({ id: "synthetic-classes", level: "error", nodeId: primaryData.id, title: "More classes than samples", detail: "Reduce the class count or add samples." });
        }
      }

      // CSV content checks: text features + unhandled missing values.
      if (facts.csv && node.category !== "visualization") {
        const { textColumns, missingCells, sampledRows } = inspectCsv(facts.csv);
        if (textColumns.length > 0) {
          diagnostics.push({
            id: `csv-text-${node.id}`,
            level: "error",
            nodeId: node.id,
            title: "Text column feeds a numeric pipeline",
            detail: `Column${textColumns.length > 1 ? "s" : ""} ${textColumns.map((c) => `“${c}”`).join(", ")} in “${facts.csv.filename}” contain${textColumns.length > 1 ? "" : "s"} non-numeric values. Remove or encode them before scaling / training.`,
          });
        }
        if (missingCells > 0 && !preNodes.some((p) => p.type === "pre:impute")) {
          diagnostics.push({
            id: `csv-missing-${node.id}`,
            level: "warning",
            nodeId: node.id,
            title: "Unhandled missing values",
            detail: `${missingCells} empty cell${missingCells === 1 ? "" : "s"} found in the first ${sampledRows} rows of “${facts.csv.filename}”. Add the Impute Missing step before scaling or training.`,
          });
        }
      }
    }

    // Test-split size sanity for tiny datasets.
    for (const node of preNodes) {
      if (node.type !== "pre:split") continue;
      const testSize = Number(paramValue(node.params, "test_size") ?? 0.2);
      if (facts.n_samples > 0 && facts.n_samples < 30) {
        diagnostics.push({
          id: `tiny-split-${node.id}`,
          level: "warning",
          nodeId: node.id,
          title: "Very small dataset",
          detail: `“${facts.name}” has ${facts.n_samples} rows — metrics will be noisy. Consider cross-validation in Colab.`,
        });
      } else if (facts.n_samples > 0 && facts.n_samples * testSize < 10) {
        diagnostics.push({
          id: `small-test-${node.id}`,
          level: "warning",
          nodeId: node.id,
          title: "Tiny test split",
          detail: `test_size=${testSize} leaves fewer than 10 rows for evaluation on ${facts.n_samples} samples.`,
        });
      }
    }
  }

  return diagnostics;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): { errors: number; warnings: number } {
  return {
    errors: diagnostics.filter((d) => d.level === "error").length,
    warnings: diagnostics.filter((d) => d.level === "warning").length,
  };
}
