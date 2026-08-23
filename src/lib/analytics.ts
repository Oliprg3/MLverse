/**
 * analytics.ts — derives interactive evaluation figures from the raw test-set
 * predictions returned by the engine. Complements the server-side Plotly
 * charts with client-computed views that are always available:
 *   - confusion matrix heatmap
 *   - per-class precision / recall / F1 bars
 *   - confidence distribution histogram
 */

import type { PerClassMetric, PredictionSet } from "./types";
import type { PlotlyFigure } from "./types";

export interface ConfusionMatrix {
  classes: string[];
  matrix: number[][];
  total: number;
  correct: number;
}

/** Build a class-indexed confusion matrix from raw predictions. */
export function confusionMatrix(pred: PredictionSet): ConfusionMatrix {
  const index = new Map<string, number>();
  // Preserve the engine's class ordering when provided.
  const classes = pred.classes.length > 0 ? [...pred.classes] : [...new Set([...pred.y_true, ...pred.y_pred].map(String))];
  classes.forEach((c, i) => index.set(String(c), i));
  const size = classes.length;
  const matrix: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  let correct = 0;
  for (let row = 0; row < pred.y_true.length; row += 1) {
    const t = index.get(String(pred.y_true[row]));
    const p = index.get(String(pred.y_pred[row]));
    if (t === undefined || p === undefined) continue;
    matrix[t][p] += 1;
    if (t === p) correct += 1;
  }
  return { classes, matrix, total: pred.y_true.length, correct };
}

export interface ClassMetricRow extends PerClassMetric {}

/** Compute precision/recall/F1/support per class directly from the matrix. */
export function perClassMetrics(cm: ConfusionMatrix): ClassMetricRow[] {
  return cm.classes.map((label, i) => {
    const tp = cm.matrix[i][i];
    const predicted = cm.matrix.reduce((sum, row) => sum + row[i], 0);
    const actual = cm.matrix[i].reduce((sum, v) => sum + v, 0);
    const precision = predicted > 0 ? tp / predicted : 0;
    const recall = actual > 0 ? tp / actual : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, precision, recall, f1, support: actual };
  });
}

/** Most-confused off-diagonal pairs, useful as an actionable summary. */
export function topConfusions(cm: ConfusionMatrix, limit = 3): Array<{ truth: string; predicted: string; count: number }> {
  const pairs: Array<{ truth: string; predicted: string; count: number }> = [];
  for (let i = 0; i < cm.classes.length; i += 1) {
    for (let j = 0; j < cm.classes.length; j += 1) {
      if (i !== j && cm.matrix[i][j] > 0) pairs.push({ truth: cm.classes[i], predicted: cm.classes[j], count: cm.matrix[i][j] });
    }
  }
  return pairs.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Plotly heatmap figure for the confusion matrix. */
export function confusionHeatmapFigure(cm: ConfusionMatrix): PlotlyFigure {
  const annotations = cm.matrix.flatMap((row, i) =>
    row.map((value, j) => ({
      x: cm.classes[j],
      y: cm.classes[i],
      text: String(value),
      showarrow: false,
      font: { color: value > Math.max(...cm.matrix.flat()) / 2 ? "#ffffff" : undefined, size: 12 },
    })),
  );
  return {
    data: [{
      type: "heatmap",
      z: cm.matrix,
      x: cm.classes,
      y: cm.classes,
      colorscale: [[0, "#f8fafc"], [1, "#0f766e"]],
      xgap: 2,
      ygap: 2,
      hovertemplate: "true %{y}<br>predicted %{x}<br>count %{z}<extra></extra>",
      colorbar: { thickness: 10, outlinewidth: 0 },
    }],
    layout: {
      margin: { t: 8, r: 0, b: 36, l: 52 },
      xaxis: { title: { text: "Predicted", standoff: 6 }, tickangle: 0 },
      yaxis: { title: { text: "True", standoff: 4 }, autorange: "reversed" },
      annotations,
      hovermode: "closest",
    },
  };
}

/** Grouped bar chart of per-class precision / recall / F1. */
export function perClassBarsFigure(rows: ClassMetricRow[]): PlotlyFigure {
  return {
    data: (["precision", "recall", "f1"] as const).map((metric, i) => ({
      type: "bar",
      name: metric === "f1" ? "F1" : metric[0].toUpperCase() + metric.slice(1),
      x: rows.map((r) => r.label),
      y: rows.map((r) => Number(r[metric].toFixed(3))),
      marker: { color: ["#0ea5e9", "#14b8a6", "#8b5cf6"][i] },
      hovertemplate: "%{x}<br>%{fullData.name} %{y:.3f}<extra></extra>",
    })),
    layout: {
      barmode: "group",
      margin: { t: 8, r: 0, b: 36, l: 40 },
      yaxis: { range: [0, 1.05], tickformat: ".1f" },
      legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0 },
      bargap: 0.25,
      bargroupgap: 0.08,
    },
  };
}

/** Histogram of the model's max-class confidence. */
export function confidenceHistogramFigure(confidence: number[]): PlotlyFigure | null {
  if (confidence.length === 0) return null;
  return {
    data: [{
      type: "histogram",
      x: confidence.map((c) => Number(c.toFixed(3))),
      nbinsx: 20,
      marker: { color: "#10b981" },
      hovertemplate: "confidence %{x}<br>count %{y}<extra></extra>",
    }],
    layout: {
      margin: { t: 8, r: 0, b: 36, l: 40 },
      xaxis: { title: { text: "Max predicted probability", standoff: 6 }, tickformat: ".1f" },
      yaxis: { title: { text: "Test rows", standoff: 4 } },
      bargap: 0.05,
    },
  };
}
