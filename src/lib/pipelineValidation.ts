/**
 * pipelineValidation.ts — client-side structural & type validation for the
 * visual pipeline graph, WITH one-click auto-fixes.
 *
 * Every diagnostic that can be repaired programmatically carries a `fix`
 * descriptor; the canvas executes it against its own state (rewires edges,
 * clamps parameters, inserts an imputer node…). Fixes that need judgement
 * (e.g. encoding a text column) stay manual but explain exactly what to do.
 */

import Papa from "papaparse";

import type { CsvDataset, GraphEdgePayload, GraphNodePayload, ImageDataset } from "./types";

export type DiagnosticLevel = "error" | "warning";

/** A machine-executable repair the canvas can apply to its own state. */
export type FixSpec =
  | { kind: "remove-edge"; edgeId: string }
  | { kind: "remove-node"; nodeId: string }
  | { kind: "set-param"; nodeId: string; key: string; value: string | number }
  | { kind: "add-imputer"; nodeId: string }
  | { kind: "resolve-text-columns"; nodeId: string; sourceId: string; columns: string[] }
  | { kind: "auto-connect" };

export interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  nodeId?: string;
  title: string;
  detail: string;
  fix?: FixSpec;
}

export interface GraphFragment {
  nodes: Array<Pick<GraphNodePayload, "id" | "type" | "category"> & { x?: number }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

const CATEGORY_ORDER: Record<string, number> = {
  data: 0,
  preprocessing: 1,
  classic_ml: 2,
  deep_learning: 2,
  visualization: 3,
};

/**
 * Wire a canonical data → preprocessing → model → visualization chain between
 * whatever stages exist, skipping links that are already present.
 * classic_ml and deep_learning are treated as one "model" stage so deep
 * learning pipelines get wired too.
 */
export function autoConnectChain(fragment: GraphFragment): Array<{ id: string; source: string; target: string }> {
  const ordered = [...fragment.nodes].sort((a, b) => {
    const rank = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
    return rank !== 0 ? rank : (a.x ?? 0) - (b.x ?? 0);
  });
  const existing = new Set(fragment.edges.map((e) => `${e.source}->${e.target}`));
  const additions: Array<{ id: string; source: string; target: string }> = [];
  let counter = fragment.edges.length;

  const modelStageOf = (category: string) => (category === "classic_ml" || category === "deep_learning" ? "model" : category);

  // Chain within the same exact category (scaler → pca …).
  const lastOfCategory = new Map<string, string>();
  for (const node of ordered) {
    const prev = lastOfCategory.get(node.category);
    if (prev && !existing.has(`${prev}->${node.id}`)) {
      additions.push({ id: `autofix-${++counter}`, source: prev, target: node.id });
      existing.add(`${prev}->${node.id}`);
    }
    lastOfCategory.set(node.category, node.id);
  }

  // Wire stage → stage (data → preprocessing → model → visualization),
  // from the LAST node of each stage into the FIRST node of the next.
  const firstOfStage = new Map<string, string>();
  const lastOfStage = new Map<string, string>();
  for (const node of ordered) {
    const stage = modelStageOf(node.category);
    if (!firstOfStage.has(stage)) firstOfStage.set(stage, node.id);
    lastOfStage.set(stage, node.id);
  }
  const stageSeq = ["data", "preprocessing", "model", "visualization"].filter((s) => firstOfStage.has(s));
  for (let i = 0; i < stageSeq.length - 1; i += 1) {
    const from = lastOfStage.get(stageSeq[i])!;
    const to = firstOfStage.get(stageSeq[i + 1])!;
    if (from !== to && !existing.has(`${from}->${to}`)) {
      additions.push({ id: `autofix-${++counter}`, source: from, target: to });
      existing.add(`${from}->${to}`);
    }
  }
  return additions.filter((a) => !fragment.edges.some((e) => e.id === a.id));
}

/** Known shapes of the built-in datasets. */
const BUILTIN_DATASETS: Record<string, { n_samples: number; n_features: number }> = {
  "data:breast_cancer": { n_samples: 569, n_features: 30 },
  "data:wine": { n_samples: 178, n_features: 13 },
  "data:iris": { n_samples: 150, n_features: 4 },
};

function paramValue(params: Record<string, string | number> | undefined, key: string): string | number | undefined {
  return params?.[key];
}

/** Inspect a CSV sample to find text-only feature columns and missing cells. */
function inspectCsv(csv: CsvDataset): { textColumns: string[]; missingCells: number; sampledRows: number } {
  // Papa parses quoted fields correctly — naive comma splitting misaligns
  // every column after a value like "Braund, Mr. Owen Harris".
  const parsed = Papa.parse<Record<string, string>>(csv.csvText.trim(), { header: true, skipEmptyLines: true });
  const columns = (parsed.meta.fields ?? []).filter(Boolean);
  if (columns.length === 0) return { textColumns: [], missingCells: 0, sampledRows: 0 };
  const rows = parsed.data.slice(0, 51);
  const textColumns = new Set<string>();
  let missingCells = 0;
  let sampledRows = 0;
  for (const row of rows) {
    sampledRows += 1;
    for (const col of columns) {
      if (col === csv.targetColumn) continue;
      const raw = (row[col] ?? "").trim();
      if (raw === "" || raw === "?" || raw.toLowerCase() === "na" || raw.toLowerCase() === "null") {
        missingCells += 1;
        continue;
      }
      if (Number.isNaN(Number(raw))) textColumns.add(col);
    }
  }
  return { textColumns: [...textColumns], missingCells, sampledRows };
}

export function validatePipeline(nodes: GraphNodePayload[], edges: GraphEdgePayload[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (nodes.length === 0) return diagnostics;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Array<{ target: string; edgeId: string }>>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), { target: edge.target, edgeId: edge.id }]);
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
  let cycleFound = false;
  const walk = (id: string) => {
    state.set(id, 1);
    for (const next of outgoing.get(id) ?? []) {
      if (cycleFound) return;
      if (state.get(next.target) === 1) {
        cycleFound = true;
        diagnostics.push({
          id: `cycle-${next.edgeId}`,
          level: "error",
          nodeId: next.target,
          title: "Circular connection",
          detail: `“${byId.get(next.target)?.label ?? next.target}” is part of a loop. Remove the back-link so data flows forward only.`,
          fix: { kind: "remove-edge", edgeId: next.edgeId },
        });
        return;
      }
      if (!state.has(next.target)) walk(next.target);
    }
    state.set(id, 2);
  };
  for (const node of nodes) if (!state.has(node.id) && !cycleFound) walk(node.id);

  // ── Stage coverage ─────────────────────────────────────────────────────────
  const dataNodes = nodes.filter((n) => n.category === "data");
  const modelNodes = nodes.filter((n) => n.category === "classic_ml" || n.category === "deep_learning");
  const vizNodes = nodes.filter((n) => n.category === "visualization");
  const preNodes = nodes.filter((n) => n.category === "preprocessing");

  const needsChain =
    dataNodes.length > 0 &&
    modelNodes.length > 0 &&
    (() => {
      // Only suggest auto-connect when at least one required link is missing.
      const pairs = new Set(edges.map((e) => `${e.source}->${e.target}`));
      const lastData = dataNodes[dataNodes.length - 1].id;
      const firstPre = preNodes[0]?.id;
      const model = modelNodes[0].id;
      const viz = vizNodes[vizNodes.length - 1]?.id;
      const chainLinks: Array<[string | undefined, string]> = [
        [lastData, firstPre ?? model],
        ...(firstPre ? ([[firstPre, model]] as Array<[string, string]>) : []),
        ...(viz ? ([[model, viz]] as Array<[string, string]>) : []),
      ];
      return chainLinks.some(([from, to]) => from && to && from !== to && !pairs.has(`${from}->${to}`));
    })();

  if (dataNodes.length === 0) {
    diagnostics.push({ id: "no-data", level: "error", title: "No dataset", detail: "Add a data node: every pipeline starts with a data source." });
  } else if (dataNodes.length > 1) {
    // Prefer deleting a data source that nothing consumes — never the wired one.
    const removable =
      dataNodes.find((d) => (outgoing.get(d.id) ?? []).length === 0 && d !== primaryData) ??
      dataNodes[dataNodes.length - 1];
    diagnostics.push({
      id: "multi-data",
      level: "warning",
      nodeId: removable.id,
      title: `${dataNodes.length} data sources`,
      detail: "Only one dataset is used per run. Disconnect or delete the extra source.",
      fix: { kind: "remove-node", nodeId: removable.id },
    });
  }

  if (modelNodes.length === 0) {
    diagnostics.push({ id: "no-model", level: "error", title: "No model", detail: "Add a classic-ML or deep-learning model node to train on." });
  }

  // ── Connectivity ───────────────────────────────────────────────────────────
  const primaryData = dataNodes[0];
  for (const node of dataNodes) {
    if ((outgoing.get(node.id) ?? []).length === 0) {
      diagnostics.push({
        id: `data-dangling-${node.id}`,
        level: node === primaryData ? "error" : "warning",
        nodeId: node.id,
        title: "Dataset is not connected",
        detail: needsChain
          ? `“${node.label}” has no outgoing link, auto-connect will wire it into the chain.`
          : `“${node.label}” has no outgoing link, nothing consumes this data.`,
        fix: needsChain ? { kind: "auto-connect" } : undefined,
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
        detail: needsChain ? `Auto-connect will chain “${node.label}” into the pipeline.` : `“${node.label}” output goes nowhere.`,
        fix: needsChain ? { kind: "auto-connect" } : undefined,
      });
    }
  }

  for (const node of modelNodes) {
    const upstream = ancestorsOf(node.id);
    if (dataNodes.length > 0 && !dataNodes.some((d) => upstream.has(d.id))) {
      diagnostics.push({
        id: `model-orphan-${node.id}`,
        level: "error",
        nodeId: node.id,
        title: "Model has no training data",
        detail: needsChain
          ? `One click wires the dataset through to “${node.label}”.`
          : `Connect a path from the data node into “${node.label}”.`,
        fix: needsChain ? { kind: "auto-connect" } : undefined,
      });
    }
  }

  for (const node of vizNodes) {
    const upstream = ancestorsOf(node.id);
    if ((incoming.get(node.id) ?? []).length === 0) {
      diagnostics.push({
        id: `viz-input-${node.id}`,
        level: "error",
        nodeId: node.id,
        title: "Visualization has no input",
        detail: needsChain
          ? `Auto-connect feeds “${node.label}” from the trained model.`
          : `“${node.label}” needs an incoming connection to know what to plot.`,
        fix: needsChain ? { kind: "auto-connect" } : undefined,
      });
    } else if (modelNodes.length > 0 && !modelNodes.some((m) => upstream.has(m.id))) {
      diagnostics.push({
        id: `viz-orphan-${node.id}`,
        level: "warning",
        nodeId: node.id,
        title: "Visualization has no model",
        detail: `Move “${node.label}” downstream of the model to unlock evaluation charts, or auto-connect the canonical chain.`,
        fix: needsChain ? { kind: "auto-connect" } : undefined,
      });
    }
  }

  // ── Dataset facts → shape-aware parameter checks ───────────────────────────
  if (primaryData) {
    const facts = {
      name: primaryData.dataset?.filename ?? primaryData.imageDataset?.name ?? primaryData.label,
      n_samples: primaryData.dataset?.nrows ?? primaryData.imageDataset?.nsamples
        ?? (primaryData.type === "data:synthetic" ? Number(paramValue(primaryData.params, "n_samples") ?? 1200) : BUILTIN_DATASETS[primaryData.type]?.n_samples ?? 0),
      n_features: primaryData.dataset ? Math.max(0, primaryData.dataset.columns.length - 1)
        : primaryData.imageDataset ? primaryData.imageDataset.width * primaryData.imageDataset.height
          : (primaryData.type === "data:synthetic" ? Number(paramValue(primaryData.params, "n_features") ?? 20) : BUILTIN_DATASETS[primaryData.type]?.n_features ?? 0),
      csv: primaryData.dataset as CsvDataset | undefined,
      syntheticParams: primaryData.type === "data:synthetic" ? primaryData.params : undefined,
    };

    let missingReported = false;
    let textReported = false;
    for (const node of [...preNodes, ...modelNodes]) {
      const upstream = ancestorsOf(node.id);
      if (!upstream.has(primaryData.id)) continue;

      if (node.type === "pre:pca") {
        const raw = Number(paramValue(node.params, "n_components") ?? 0.95);
        if (!Number.isNaN(raw) && raw >= 1 && facts.n_features > 0 && raw > facts.n_features) {
          const suggested = Math.max(1, Math.floor(facts.n_features * 0.95));
          diagnostics.push({
            id: `pca-${node.id}`,
            level: "error",
            nodeId: node.id,
            title: "PCA exceeds feature count",
            detail: `n_components=${raw} but “${facts.name}” has ${facts.n_features} features. We can set it to ${suggested}.`,
            fix: { kind: "set-param", nodeId: node.id, key: "n_components", value: suggested },
          });
        }
      }

      if (node.type === "ml:knn") {
        const k = Number(paramValue(node.params, "n_neighbors") ?? 5);
        if (facts.n_samples > 0 && k >= facts.n_samples) {
          const suggested = Math.max(1, Math.min(k, Math.floor(facts.n_samples * 0.2)));
          diagnostics.push({
            id: `knn-${node.id}`,
            level: "error",
            nodeId: node.id,
            title: "k larger than the training set",
            detail: `n_neighbors=${k} but the dataset has ${facts.n_samples} samples. We can lower k to ${suggested}.`,
            fix: { kind: "set-param", nodeId: node.id, key: "n_neighbors", value: suggested },
          });
        }
      }

      if (facts.csv && node.category !== "visualization") {
        const { textColumns, missingCells, sampledRows } = inspectCsv(facts.csv);
        if (textColumns.length > 0 && !textReported) {
          textReported = true;
          diagnostics.push({
            id: `csv-text-${node.id}`,
            level: "error",
            nodeId: node.id,
            title: "Text column feeds a numeric pipeline",
            detail: `Column${textColumns.length > 1 ? "s" : ""} ${textColumns.map((c) => `“${c}”`).join(", ")} in “${facts.csv.filename}” contain${textColumns.length > 1 ? "" : "s"} non-numeric values. Confirm a fix and we rewrite the dataset: drop the columns, or encode them.`,
            fix: { kind: "resolve-text-columns", nodeId: node.id, sourceId: primaryData.id, columns: textColumns },
          });
        }
        if (missingCells > 0 && !preNodes.some((p) => p.type === "pre:impute") && !missingReported) {
          missingReported = true;
          diagnostics.push({
            id: `csv-missing-${node.id}`,
            level: "warning",
            nodeId: node.id,
            title: "Unhandled missing values",
            detail: `${missingCells} empty cell${missingCells === 1 ? "" : "s"} found in the first ${sampledRows} rows of “${facts.csv.filename}”. One click inserts median imputation before this step.`,
            fix: { kind: "add-imputer", nodeId: node.id },
          });
        }
      }
    }

    for (const node of preNodes) {
      if (node.type !== "pre:split") continue;
      const testSize = Number(paramValue(node.params, "test_size") ?? 0.2);
      if (facts.n_samples > 0 && facts.n_samples < 30) {
        diagnostics.push({
          id: `tiny-split-${node.id}`,
          level: "warning",
          nodeId: node.id,
          title: "Very small dataset",
          detail: `“${facts.name}” has ${facts.n_samples} rows, so metrics will be noisy. Consider cross-validation in Colab.`,
        });
      } else if (facts.n_samples > 0 && facts.n_samples * testSize < 10) {
        diagnostics.push({
          id: `small-test-${node.id}`,
          level: "warning",
          nodeId: node.id,
          title: "Tiny test split",
          detail: `test_size=${testSize} leaves fewer than 10 rows for evaluation on ${facts.n_samples} samples.`,
          fix: { kind: "set-param", nodeId: node.id, key: "test_size", value: 0.25 },
        });
      }
    }
  }

  return diagnostics;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): { errors: number; warnings: number; fixes: number } {
  return {
    errors: diagnostics.filter((d) => d.level === "error").length,
    warnings: diagnostics.filter((d) => d.level === "warning").length,
    fixes: diagnostics.filter((d) => d.fix).length,
  };
}
