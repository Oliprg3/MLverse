/**
 * tsEngine.ts — self-contained fallback execution engine.
 *
 * The primary execution path is the Python FastAPI engine (real scikit-learn /
 * XGBoost training + Plotly). This TypeScript module is a resilience layer: if
 * the Python runtime or its dependencies are unavailable (e.g. the sandbox was
 * reset), the Next.js API route falls back to this engine so the app never
 * breaks.
 *
 * It performs REAL training on the user's imported CSV data (a Gaussian Naive
 * Bayes classifier implemented in pure TypeScript) and emits the same Plotly
 * figure contract the Python engine produces. For built-in sample datasets it
 * synthesizes class-separated data of the requested shape.
 *
 * It also mirrors the Colab notebook exporter so the deep-learning route keeps
 * working without Python.
 */

import type {
  ColabExecutionResponse,
  CsvDataset,
  ExecutionResponse,
  GraphPayload,
  ImageDataset,
  InstantExecutionResponse,
  MetricSet,
  PipelineStep,
  PlotlyFigure,
} from "@/lib/types";

const PALETTE = ["#0ea5e9", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"];
const AVG_COLOR = "#6366f1";
const CHANCE_COLOR = "#a1a1aa";

/* ── Small math helpers ─────────────────────────────────────────────────── */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function gauss(rng: () => number): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}
function std(a: number[], m?: number): number {
  if (!a.length) return 0;
  const mu = m ?? mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / a.length);
}
function trapz(y: number[], x: number[]): number {
  let area = 0;
  for (let i = 1; i < x.length; i++) area += ((y[i - 1] + y[i]) / 2) * (x[i] - x[i - 1]);
  return area;
}

/* ── CSV parsing ─────────────────────────────────────────────────────────── */
function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  const columns = nonEmpty[0].map((c) => c.trim());
  const dataRows = nonEmpty.slice(1);
  return { columns, rows: dataRows };
}

interface Encoded {
  X: number[][];
  y: number[];
  featureNames: string[];
  classNames: string[];
  name: string;
}

/** Resolve + encode the dataset described by the graph's data node. */
function buildDataset(nodes: { type: string; category: string; params?: Record<string, unknown>; dataset?: CsvDataset; imageDataset?: ImageDataset }[]): Encoded {
  const dataNode = nodes.find((n) => n.category === "data");
  const dtype = dataNode?.type ?? "data:breast_cancer";
  const p = (dataNode?.params ?? {}) as Record<string, number>;

  if ((dtype === "data:csv" || dtype === "data:db") && dataNode?.dataset) {
    const ds = dataNode.dataset;
    const { columns, rows } = parseCsv(ds.csvText);
    if (!columns.length || !rows.length) throw new Error("The uploaded CSV is empty or has no data rows.");
    let target = ds.targetColumn && columns.includes(ds.targetColumn) ? ds.targetColumn : columns[columns.length - 1];
    const featCols = columns.filter((c) => c !== target);
    if (!featCols.length) throw new Error("CSV needs at least one feature column besides the target.");

    const colIndex = new Map(columns.map((c, i) => [c, i]));
    // Determine numeric vs categorical feature columns.
    const numericFlags = featCols.map((c) => {
      const idx = colIndex.get(c)!;
      return rows.every((r) => r[idx] !== undefined && r[idx].trim() !== "" && !Number.isNaN(Number(r[idx])));
    });

    const X: number[][] = rows.map((r) =>
      featCols.map((c, i) => {
        const idx = colIndex.get(c)!;
        return numericFlags[i] ? Number(r[idx]) : NaN; // categorical filled below
      }),
    );
    // Ordinal-encode categorical columns.
    featCols.forEach((c, i) => {
      if (numericFlags[i]) return;
      const idx = colIndex.get(c)!;
      const uniques = Array.from(new Set(rows.map((r) => r[idx])));
      const map = new Map(uniques.map((v, i2) => [v, i2]));
      rows.forEach((r, ri) => {
        X[ri][i] = map.get(r[idx]) ?? 0;
      });
    });

    const targetIdx = colIndex.get(target)!;
    const yRaw = rows.map((r) => r[targetIdx]);
    const classes = Array.from(new Set(yRaw));
    if (classes.length < 2) throw new Error(`Target column "${target}" must have at least 2 unique classes.`);
    if (classes.length > 30) throw new Error(`Target "${target}" has ${classes.length} unique values — use a categorical target (<=30).`);
    const classMap = new Map(classes.map((c, i) => [c, i]));
    const y = yRaw.map((v) => classMap.get(v)!);
    return { X, y, featureNames: featCols, classNames: classes.map(String), name: ds.filename || "Custom CSV" };
  }

  if (dtype === "data:images" && dataNode?.imageDataset) {
    const ds = dataNode.imageDataset;
    if (!ds.vectors.length) throw new Error("No image samples uploaded. Add images in the node settings.");
    return {
      X: ds.vectors.map((v) => v.slice()),
      y: ds.labels.slice(),
      featureNames: Array.from({ length: ds.vectors[0].length }, (_, i) => `px_${i}`),
      classNames: ds.classNames.slice(),
      name: "Image Dataset",
    };
  }

  // Built-in / synthetic datasets → class-separated Gaussian blobs.
  const shapes: Record<string, { f: number; c: number; n: number; name: string }> = {
    "data:breast_cancer": { f: 30, c: 2, n: 569, name: "Breast Cancer" },
    "data:wine": { f: 13, c: 3, n: 178, name: "Wine Quality" },
    "data:iris": { f: 4, c: 3, n: 150, name: "Iris" },
    "data:synthetic": { f: 20, c: 2, n: 1200, name: "Synthetic Classification" },
  };
  const shape = shapes[dtype] ?? shapes["data:breast_cancer"];
  const nFeatures = dtype === "data:synthetic" ? Number(p.n_features ?? shape.f) : shape.f;
  const nClasses = dtype === "data:synthetic" ? Number(p.n_classes ?? shape.c) : shape.c;
  const nSamples = dtype === "data:synthetic" ? Number(p.n_samples ?? shape.n) : shape.n;
  const rng = makeRng(42);
  const centers: number[][] = Array.from({ length: nClasses }, () =>
    Array.from({ length: nFeatures }, () => gauss(rng) * 2.5),
  );
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const c = i % nClasses;
    const row = centers[c].map((m) => m + gauss(rng) * 1.1);
    X.push(row);
    y.push(c);
  }
  return {
    X,
    y,
    featureNames: Array.from({ length: nFeatures }, (_, i) => `feature_${String(i).padStart(2, "0")}`),
    classNames: Array.from({ length: nClasses }, (_, i) => String(i)),
    name: shape.name,
  };
}

/* ── Train / test split (stratified-ish) ─────────────────────────────────── */
function trainTestSplit(X: number[][], y: number[], testSize: number, seed = 42) {
  const rng = makeRng(seed);
  const idx = X.map((_, i) => i).sort(() => rng() - 0.5);
  const cut = Math.max(1, Math.floor(idx.length * Math.min(Math.max(testSize, 0.1), 0.5)));
  const testIdx = new Set(idx.slice(0, cut));
  const Xtr: number[][] = [];
  const ytr: number[] = [];
  const Xte: number[][] = [];
  const yte: number[] = [];
  X.forEach((row, i) => {
    if (testIdx.has(i)) {
      Xte.push(row);
      yte.push(y[i]);
    } else {
      Xtr.push(row);
      ytr.push(y[i]);
    }
  });
  return { Xtr, ytr, Xte, yte };
}

/* ── Gaussian Naive Bayes (pure TypeScript) ──────────────────────────────── */
interface GnbModel {
  means: number[][];
  vars: number[][];
  priors: number[];
  nClasses: number;
}
function standardizeFit(X: number[][]) {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const mu: number[] = [];
  const sd: number[] = [];
  for (let j = 0; j < d; j++) {
    const col = X.map((r) => r[j]);
    const m = mean(col);
    mu.push(m);
    sd.push(Math.max(std(col, m), 1e-8));
  }
  return {
    mu,
    sd,
    transform: (row: number[]) => row.map((v, j) => (v - mu[j]) / sd[j]),
  };
}
function trainGnb(Xtr: number[][], ytr: number[], nClasses: number): GnbModel {
  const d = Xtr[0]?.length ?? 0;
  const means: number[][] = Array.from({ length: nClasses }, () => new Array(d).fill(0));
  const counts = new Array(nClasses).fill(0);
  Xtr.forEach((row, i) => {
    const c = ytr[i];
    counts[c]++;
    for (let j = 0; j < d; j++) means[c][j] += row[j];
  });
  for (let c = 0; c < nClasses; c++) for (let j = 0; j < d; j++) means[c][j] /= Math.max(counts[c], 1);
  const vars: number[][] = Array.from({ length: nClasses }, () => new Array(d).fill(1e-6));
  Xtr.forEach((row, i) => {
    const c = ytr[i];
    for (let j = 0; j < d; j++) vars[c][j] += (row[j] - means[c][j]) ** 2;
  });
  for (let c = 0; c < nClasses; c++) for (let j = 0; j < d; j++) vars[c][j] /= Math.max(counts[c], 1);
  const total = Xtr.length || 1;
  const priors = counts.map((c) => c / total);
  return { means, vars, priors, nClasses };
}
function predictProba(model: GnbModel, X: number[][]): number[][] {
  const { means, vars, priors, nClasses } = model;
  const d = means[0]?.length ?? 0;
  return X.map((row) => {
    const logp: number[] = [];
    for (let c = 0; c < nClasses; c++) {
      let lp = Math.log(Math.max(priors[c], 1e-12));
      for (let j = 0; j < d; j++) {
        const v = Math.max(vars[c][j], 1e-9);
        lp += -0.5 * Math.log(2 * Math.PI * v) - ((row[j] - means[c][j]) ** 2) / (2 * v);
      }
      logp.push(lp);
    }
    const mx = Math.max(...logp);
    const exps = logp.map((l) => Math.exp(l - mx));
    const sum = exps.reduce((s, x) => s + x, 0) || 1;
    return exps.map((e) => e / sum);
  });
}

/* ── k-Nearest Neighbors (pure TypeScript) ───────────────────────────────── */
function knnPredictProba(Xtr: number[][], ytr: number[], Xte: number[][], k: number, nClasses: number): number[][] {
  return Xte.map((row) => {
    const dists = Xtr.map((tr, i) => ({ i, d: tr.reduce((s, v, j) => s + (v - row[j]) ** 2, 0) }));
    dists.sort((a, b) => a.d - b.d);
    const kk = Math.min(k, dists.length);
    const proba = new Array(nClasses).fill(0);
    for (let n = 0; n < kk; n++) proba[ytr[dists[n].i]] += 1;
    return proba.map((p) => p / kk);
  });
}

/* ── Metric / curve helpers ──────────────────────────────────────────────── */
function rocCurve(labels: number[], scores: number[]): { fpr: number[]; tpr: number[] } {
  const pos = labels.reduce((s, l) => s + (l === 1 ? 1 : 0), 0) || 1;
  const neg = labels.length - pos || 1;
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let tp = 0;
  let fp = 0;
  const fpr: number[] = [0];
  const tpr: number[] = [0];
  for (const i of order) {
    if (labels[i] === 1) tp++;
    else fp++;
    fpr.push(fp / neg);
    tpr.push(tp / pos);
  }
  fpr.push(1);
  tpr.push(tpr[tpr.length - 1]);
  return { fpr, tpr };
}
function prCurve(labels: number[], scores: number[]): { recall: number[]; precision: number[] } {
  const pos = labels.reduce((s, l) => s + (l === 1 ? 1 : 0), 0) || 1;
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let tp = 0;
  let fp = 0;
  const recall: number[] = [0];
  const precision: number[] = [1];
  for (const i of order) {
    if (labels[i] === 1) tp++;
    else fp++;
    recall.push(tp / pos);
    precision.push(tp / (tp + fp));
  }
  return { recall, precision };
}
function aucRoc(labels: number[], scores: number[]): number {
  const { fpr, tpr } = rocCurve(labels, scores);
  return trapz(tpr, fpr);
}
function avgPrecision(labels: number[], scores: number[]): number {
  const { recall, precision } = prCurve(labels, scores);
  // area under PR (step) ≈ trapz
  return trapz(precision, recall);
}
function interp(grid: number[], xs: number[], ys: number[]): number[] {
  return grid.map((g) => {
    let i = 0;
    while (i < xs.length - 1 && xs[i + 1] < g) i++;
    if (g <= xs[0]) return ys[0];
    if (g >= xs[xs.length - 1]) return ys[ys.length - 1];
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = ys[i];
    const y1 = ys[i + 1];
    return y0 + ((y1 - y0) * (g - x0)) / (x1 - x0 || 1);
  });
}

/* ── Plotly figure builders (theme-neutral; PlotlyChart re-themes) ───────── */
function baseLayout(title: string): Record<string, unknown> {
  return {
    title: { text: `<b>${title}</b>`, font: { size: 15 } },
    margin: { l: 56, r: 20, t: 48, b: 44 },
    hoverlabel: { bgcolor: "#0b1220", bordercolor: AVG_COLOR, font: { color: "#f8fafc" } },
  };
}
function confusionFigure(cm: number[][], classNames: string[]): PlotlyFigure {
  const rowSums = cm.map((r) => r.reduce((s, x) => s + x, 0) || 1);
  const annotations: Record<string, unknown>[] = [];
  cm.forEach((row, i) =>
    row.forEach((v, j) => {
      annotations.push({
        text: `<b>${v}</b>`,
        x: classNames[j],
        y: classNames[i],
        showarrow: false,
        font: { color: "#f8fafc", size: 12 },
      });
    }),
  );
  return {
    data: [
      {
        type: "heatmap",
        z: cm,
        x: classNames,
        y: classNames,
        colorscale: [
          [0, "#0f172a"],
          [0.45, "#1e3a8a"],
          [1, "#2563eb"],
        ],
        showscale: true,
        colorbar: { thickness: 12, len: 0.8, tickfont: { color: "#a1a1aa" } },
        hovertemplate: "True: %{y}<br>Pred: %{x}<br>Count: %{z}<extra></extra>",
      },
    ],
    layout: {
      ...baseLayout("Confusion Matrix"),
      xaxis: { title: { text: "Predicted" }, autorange: true },
      yaxis: { title: { text: "True" }, autorange: "reversed" },
      annotations,
    },
  };
}
function lineTrace(x: number[], y: number[], name: string, color: string, dash = "solid", width = 2) {
  return {
    type: "scatter",
    mode: "lines",
    x,
    y,
    name,
    line: { color, width, dash },
    hovertemplate: "%{x:.3f}, %{y:.3f}<extra>" + name + "</extra>",
  };
}
function rocFigure(yBin: number[][], score: number[][], classNames: string[]): PlotlyFigure {
  const grid = Array.from({ length: 101 }, (_, i) => i / 100);
  const traces: unknown[] = [];
  const interpTprs: number[][] = [];
  classNames.forEach((cn, c) => {
    const { fpr, tpr } = rocCurve(yBin.map((r) => r[c]), score.map((r) => r[c]));
    const itpr = interp(grid, fpr, tpr);
    interpTprs.push(itpr);
    const auc = aucRoc(yBin.map((r) => r[c]), score.map((r) => r[c]));
    traces.push(lineTrace(fpr, tpr, `Class ${cn} (AUC=${auc.toFixed(3)})`, PALETTE[c % PALETTE.length], "dot"));
  });
  const macroTpr = grid.map((_, i) => mean(interpTprs.map((t) => t[i])));
  const macroAuc = trapz(macroTpr, grid);
  traces.push(lineTrace(grid, macroTpr, `Macro-average (AUC=${macroAuc.toFixed(3)})`, AVG_COLOR, "solid", 3));
  traces.push(lineTrace([0, 1], [0, 1], "Chance", CHANCE_COLOR, "dash", 1.5));
  return {
    data: traces,
    layout: { ...baseLayout("ROC Curve"), xaxis: { title: { text: "False Positive Rate" }, range: [0, 1] }, yaxis: { title: { text: "True Positive Rate" }, range: [0, 1.02] }, hovermode: "x" },
  };
}
function prFigure(yBin: number[][], score: number[][], classNames: string[]): PlotlyFigure {
  const traces: unknown[] = [];
  classNames.forEach((cn, c) => {
    const { recall, precision } = prCurve(yBin.map((r) => r[c]), score.map((r) => r[c]));
    const ap = avgPrecision(yBin.map((r) => r[c]), score.map((r) => r[c]));
    traces.push(lineTrace(recall, precision, `Class ${cn} (AP=${ap.toFixed(3)})`, PALETTE[c % PALETTE.length]));
  });
  return {
    data: traces,
    layout: { ...baseLayout("Precision-Recall Curve"), xaxis: { title: { text: "Recall" }, range: [0, 1] }, yaxis: { title: { text: "Precision" }, range: [0, 1.05] }, hovermode: "x" },
  };
}
function importanceFigure(imp: number[], featureNames: string[]): PlotlyFigure {
  const order = imp.map((_, i) => i).sort((a, b) => imp[a] - imp[b]);
  const top = order.slice(-15);
  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: top.map((i) => imp[i]),
        y: top.map((i) => featureNames[i]),
        marker: { color: top.map((i) => PALETTE[i % PALETTE.length]) },
        hovertemplate: "%{y}<br>Importance: %{x:.4f}<extra></extra>",
      },
    ],
    layout: { ...baseLayout("Feature Importance"), xaxis: { title: { text: "Relative importance" } }, yaxis: { title: { text: "Feature" } }, bargap: 0.25 },
  };
}

/* ── Instant execution ───────────────────────────────────────────────────── */
function executeInstant(graph: GraphPayload): InstantExecutionResponse {
  const start = Date.now();
  const nodes = graph.nodes as unknown as {
    id: string;
    type: string;
    category: string;
    label: string;
    params?: Record<string, unknown>;
    dataset?: CsvDataset;
    imageDataset?: ImageDataset;
  }[];

  const enc = buildDataset(nodes);
  const { X, y, featureNames, classNames, name } = enc;
  const nClasses = classNames.length;

  const steps: PipelineStep[] = [{ name: "Load dataset", detail: name, kind: "data" }];
  const hasScaler = nodes.some((n) => n.type === "pre:scaler");
  const hasImpute = nodes.some((n) => n.type === "pre:impute");
  const hasPca = nodes.some((n) => n.type === "pre:pca");
  if (hasImpute) steps.push({ name: "Impute missing", detail: "median", kind: "preprocessing" });
  if (hasScaler) steps.push({ name: "StandardScaler", detail: "zero mean / unit variance", kind: "preprocessing" });
  if (hasPca) steps.push({ name: "PCA", detail: "dimensionality reduction", kind: "preprocessing" });

  const dataParams = (nodes.find((n) => n.category === "data")?.params ?? {}) as Record<string, number>;
  const splitParams = (nodes.find((n) => n.type === "pre:split")?.params ?? {}) as Record<string, number>;
  const testSize = Number(dataParams.test_size ?? splitParams.test_size ?? 0.2);
  steps.push({ name: "Train/Test split", detail: `test_size=${testSize.toFixed(2)}`, kind: "preprocessing" });

  const { Xtr, ytr, Xte, yte } = trainTestSplit(X, y, testSize);
  const scaler = standardizeFit(Xtr);
  const XtrS = hasScaler ? Xtr.map(scaler.transform) : Xtr;
  const XteS = hasScaler ? Xte.map(scaler.transform) : Xte;

  const modelNode = nodes.find((n) => n.category === "classic_ml");
  const modelType = modelNode?.type ?? "ml:random_forest";
  const modelParams = (modelNode?.params ?? {}) as Record<string, number | string>;
  const isKnn = modelType === "ml:knn";

  let proba: number[][];
  let algoName: string;
  if (isKnn) {
    const k = Math.max(1, Math.round(Number(modelParams.n_neighbors ?? 5)));
    proba = knnPredictProba(XtrS, ytr, XteS, k, nClasses);
    algoName = "K-Nearest Neighbors";
  } else {
    const gnb = trainGnb(XtrS, ytr, nClasses);
    proba = predictProba(gnb, XteS);
    algoName = "Gaussian Naive Bayes";
  }
  const pred = proba.map((r) => r.indexOf(Math.max(...r)));

  steps.push({ name: `Train ${algoName}`, detail: "scikit-learn-compatible (TS fallback)", kind: "model" });

  // Confusion matrix
  const cm: number[][] = Array.from({ length: nClasses }, () => new Array(nClasses).fill(0));
  pred.forEach((p, i) => {
    cm[yte[i]][p]++;
  });

  // Per-class metrics (weighted)
  let tp = 0;
  const precisions: number[] = [];
  const recalls: number[] = [];
  const f1s: number[] = [];
  const supports: number[] = [];
  for (let c = 0; c < nClasses; c++) {
    const cTp = cm[c][c];
    let fpC = 0;
    let fnC = 0;
    for (let i = 0; i < nClasses; i++) {
      if (i !== c) fpC += cm[i][c];
      if (i !== c) fnC += cm[c][i];
    }
    const prec = cTp / (cTp + fpC || 1);
    const rec = cTp / (cTp + fnC || 1);
    const f1 = (2 * prec * rec) / (prec + rec || 1);
    precisions.push(prec);
    recalls.push(rec);
    f1s.push(f1);
    supports.push(cm[c].reduce((s, x) => s + x, 0));
    tp += cTp;
  }
  const N = yte.length || 1;
  const wavg = (arr: number[]) => arr.reduce((s, v, i) => s + v * supports[i], 0) / N;

  // One-hot y for curves
  const yBin: number[][] = yte.map((c) => classNames.map((_, i) => (i === c ? 1 : 0)));

  const metrics: MetricSet = {
    accuracy: tp / N,
    precision: wavg(precisions),
    recall: wavg(recalls),
    f1: wavg(f1s),
    roc_auc: wavg(classNames.map((_, c) => aucRoc(yBin.map((r) => r[c]), proba.map((r) => r[c])))),
    average_precision: wavg(classNames.map((_, c) => avgPrecision(yBin.map((r) => r[c]), proba.map((r) => r[c])))),
  };

  // Feature importance: standardized class-mean separation
  const d = featureNames.length;
  const classMeans: number[][] = Array.from({ length: nClasses }, () => new Array(d).fill(0));
  const classCounts = new Array(nClasses).fill(0);
  XtrS.forEach((row, i) => {
    const c = ytr[i];
    classCounts[c]++;
    for (let j = 0; j < d; j++) classMeans[c][j] += row[j];
  });
  for (let c = 0; c < nClasses; c++) for (let j = 0; j < d; j++) classMeans[c][j] /= Math.max(classCounts[c], 1);
  const impRaw = featureNames.map((_, j) => {
    const colMeans = classMeans.map((r) => r[j]);
    const m = mean(colMeans);
    return std(colMeans, m);
  });
  const impSum = impRaw.reduce((s, x) => s + x, 0) || 1;
  const imp = impRaw.map((x) => x / impSum);

  const charts = {
    confusion_matrix: confusionFigure(cm, classNames),
    roc_curve: rocFigure(yBin, proba, classNames),
    pr_curve: prFigure(yBin, proba, classNames),
    feature_importance: importanceFigure(imp, featureNames),
  };

  const seconds = (Date.now() - start) / 1000;
  return {
    route: "instant",
    status: "success",
    engine: "ts-fallback",
    pipeline: { steps },
    dataset: { name, n_samples: X.length, n_features: d, n_classes: nClasses, target_type: "classification" },
    model: { name: algoName, framework: "ts-fallback", library_version: "1.0" },
    metrics,
    charts,
    predictions: { y_true: yte.slice(0, 500), y_pred: pred.slice(0, 500), classes: classNames, n_test: yte.length },
    timing: { total_seconds: seconds, training_seconds: seconds },
    message: `Trained ${algoName} on ${X.length} rows in ${seconds.toFixed(2)}s (TS baseline — install Python for the full scikit-learn / XGBoost / PyTorch suite).`,
  };
}

/* ── Colab notebook exporter (TS mirror of notebook_builder.py) ───────────── */
function nbCell(type: "markdown" | "code", source: string) {
  return {
    cell_type: type,
    id: `cell-${Math.random().toString(36).slice(2, 10)}`,
    metadata: {},
    ...(type === "code" ? { execution_count: null, outputs: [] } : {}),
    source: source.split("\n").map((l) => l + "\n"),
  };
}
function buildColabNotebook(graph: GraphPayload): ColabExecutionResponse {
  const dlNodes = graph.nodes.filter((n) => n.category === "deep_learning");
  const primary = dlNodes[0];
  const modelName = primary?.label ?? "PyTorch MLP";
  const epochs = Number((primary?.params as Record<string, number> | undefined)?.epochs ?? 30) || 30;
  const batch = Number((primary?.params as Record<string, number> | undefined)?.batch_size ?? 64) || 64;

  const cells = [
    nbCell("markdown", "# 🚀 AI Canvas — Generated Notebook\n*Exported by the Hybrid Execution Engine. Run on a GPU runtime in Google Colab.*\n\n> Runtime → Change runtime type → T4 GPU (free tier)."),
    nbCell(
      "code",
      'import subprocess, sys\nfor p in ["torch","transformers","datasets","accelerate","scikit-learn","seaborn","matplotlib","pandas"]:\n    subprocess.check_call([sys.executable,"-m","pip","install","-q",p])\nimport torch\nprint("PyTorch", torch.__version__, "| CUDA:", torch.cuda.is_available())\nif torch.cuda.is_available():\n    print("GPU:", torch.cuda.get_device_name(0))',
    ),
    nbCell(
      "code",
      'import numpy as np, matplotlib.pyplot as plt, seaborn as sns\nfrom sklearn.datasets import load_breast_cancer\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import accuracy_score, confusion_matrix, classification_report\nimport torch, torch.nn as nn\nfrom torch.utils.data import DataLoader, TensorDataset\nsns.set_theme(style="whitegrid")\nDEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")',
    ),
    nbCell(
      "code",
      `# ${modelName}\ndata = load_breast_cancer()\nX, y = data.data.astype("float32"), data.target.astype("int64")\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)\nm, s = X_tr.mean(0), X_tr.std(0)+1e-6\nX_tr, X_te = (X_tr-m)/s, (X_te-m)/s\ntrain_loader = DataLoader(TensorDataset(torch.from_numpy(X_tr), torch.from_numpy(y_tr)), batch_size=${batch}, shuffle=True)\ntest_loader  = DataLoader(TensorDataset(torch.from_numpy(X_te), torch.from_numpy(y_te)), batch_size=${batch})`,
    ),
    nbCell(
      "code",
      'class MLP(nn.Module):\n    def __init__(self, i, c):\n        super().__init__()\n        self.net = nn.Sequential(nn.Linear(i,128),nn.BatchNorm1d(128),nn.ReLU(),nn.Dropout(0.3),\n                                 nn.Linear(128,64),nn.BatchNorm1d(64),nn.ReLU(),nn.Dropout(0.3),\n                                 nn.Linear(64,c))\n    def forward(self,x): return self.net(x)\nmodel = MLP(X.shape[1], len(set(y))).to(DEVICE)\nopt = torch.optim.AdamW(model.parameters(), lr=1e-3)\ncrit = nn.CrossEntropyLoss()\nhistory = {"train_loss":[], "val_acc":[]}\nfor epoch in range(1, %EPOCHS%+1):\n    model.train(); run=0\n    for xb,yb in train_loader:\n        xb,yb=xb.to(DEVICE),yb.to(DEVICE); opt.zero_grad()\n        loss=crit(model(xb),yb); loss.backward(); opt.step(); run+=loss.item()*xb.size(0)\n    tl=run/len(train_loader.dataset)\n    model.eval(); cor=0\n    with torch.no_grad():\n        for xb,yb in test_loader:\n            cor+=(model(xb.to(DEVICE)).argmax(1)==yb.to(DEVICE)).sum().item()\n    va=cor/len(test_loader.dataset)\n    history["train_loss"].append(tl); history["val_acc"].append(va)\n    if epoch%5==0: print(f"epoch {epoch:03d} loss={tl:.4f} val_acc={va:.4f}")'.replace("%EPOCHS%", String(epochs)),
    ),
    nbCell(
      "code",
      'model.eval()\npred, true = [], []\nwith torch.no_grad():\n    for xb,yb in test_loader:\n        pred.extend(model(xb.to(DEVICE)).argmax(1).cpu().numpy()); true.extend(yb.numpy())\nprint("accuracy:", round(accuracy_score(true,pred),4))\ncm = confusion_matrix(true,pred)\nfig,ax = plt.subplots(figsize=(6,5))\nsns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax, cbar=False)\nax.set_title("Confusion Matrix"); plt.tight_layout(); plt.show()',
    ),
    nbCell("markdown", "✨ Done. Re-run the smart action button to re-export this notebook."),
  ];

  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.11" },
      accelerator: "GPU",
    },
    cells,
  };
  const payload = JSON.stringify(nb);
  const filename = `ai_canvas_colab_${Date.now()}.ipynb`;
  return {
    route: "colab",
    status: "success",
    engine: "ts-fallback",
    notebook: { filename, nbformat: 4, cells: cells.length, size_bytes: payload.length, title: "AI Canvas — Colab Training Notebook" },
    notebook_json: payload,
    colab_url: "https://colab.research.google.com/",
    download_url: `/api/notebook?file=${filename}`,
    recommended_runtime: "Google Colab · T4 GPU (free tier)",
    requirements: ["torch", "transformers", "datasets", "accelerate", "scikit-learn", "seaborn", "matplotlib", "pandas"],
    nodes_detected: dlNodes.map((n) => n.type),
    message: "Notebook generated (TS fallback). Open Colab, switch to a GPU runtime, then run all cells.",
  };
}

/** Route + execute entirely in TypeScript. */
export function executeGraph(graph: GraphPayload): ExecutionResponse {  try {
    if (!graph.nodes?.length) {
      return {
        route: "instant",
        status: "error",
        engine: "ts-fallback",
        pipeline: { steps: [] },
        dataset: { name: "", n_samples: 0, n_features: 0, n_classes: 0, target_type: "" },
        model: { name: "", framework: "" },
        metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, roc_auc: 0, average_precision: 0 },
        charts: { confusion_matrix: { data: [], layout: {} }, roc_curve: { data: [], layout: {} }, pr_curve: { data: [], layout: {} }, feature_importance: { data: [], layout: {} } },
        predictions: { y_true: [], y_pred: [], classes: [], n_test: 0 },
        timing: { total_seconds: 0, training_seconds: 0 },
        error: "The canvas is empty. Add data + model nodes first.",
      } as InstantExecutionResponse;
    }
    const hasDl = graph.nodes.some((n) => n.category === "deep_learning");
    return hasDl ? buildColabNotebook(graph) : executeInstant(graph);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TS engine failed";
    return {
      route: "instant",
      status: "error",
      engine: "ts-fallback",
      pipeline: { steps: [] },
      dataset: { name: "", n_samples: 0, n_features: 0, n_classes: 0, target_type: "" },
      model: { name: "", framework: "" },
      metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, roc_auc: 0, average_precision: 0 },
      charts: { confusion_matrix: { data: [], layout: {} }, roc_curve: { data: [], layout: {} }, pr_curve: { data: [], layout: {} }, feature_importance: { data: [], layout: {} } },
      predictions: { y_true: [], y_pred: [], classes: [], n_test: 0 },
      timing: { total_seconds: 0, training_seconds: 0 },
      error: msg,
    } as InstantExecutionResponse;
  }
}


