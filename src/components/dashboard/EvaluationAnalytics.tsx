"use client";

import { useMemo } from "react";
import {
  confidenceHistogramFigure,
  confusionHeatmapFigure,
  confusionMatrix,
  perClassBarsFigure,
  perClassMetrics,
  topConfusions,
} from "@/lib/analytics";
import { PlotlyChart } from "./PlotlyChart";
import type { PredictionSet } from "@/lib/types";

/**
 * Client-computed interactive analytics derived from the raw test predictions:
 * confusion-matrix heatmap, per-class metric bars, and a confidence histogram.
 */
export function EvaluationAnalytics({ predictions }: { predictions: PredictionSet }) {
  const cm = useMemo(() => confusionMatrix(predictions), [predictions]);
  const classRows = useMemo(() => perClassMetrics(cm), [cm]);
  const confusions = useMemo(() => topConfusions(cm, 2), [cm]);
  const heat = useMemo(() => confusionHeatmapFigure(cm), [cm]);
  const bars = useMemo(() => perClassBarsFigure(classRows), [classRows]);
  const hist = useMemo(() => confidenceHistogramFigure(predictions.confidence ?? []), [predictions.confidence]);

  if (predictions.n_test === 0 || cm.classes.length === 0) return null;
  const accuracy = cm.total > 0 ? cm.correct / cm.total : 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold tracking-tight text-foreground">Prediction analytics</h4>
        <p className="font-mono text-[10px] text-muted-2">
          {cm.correct}/{cm.total} correct · {(accuracy * 100).toFixed(1)}% on the held-out split
        </p>
      </div>

      {confusions.length > 0 ? (
        <p className="text-xs leading-5 text-muted">
          Most confused:{" "}
          {confusions.map((pair, i) => (
            <span key={`${pair.truth}-${pair.predicted}`}>
              {i > 0 ? " · " : ""}
              <span className="font-medium text-foreground-2">{pair.truth}</span> → {pair.predicted} ({pair.count})
            </span>
          ))}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-[280px]">
          <PlotlyChart figure={heat} title="Confusion Matrix" className="animate-chart-in" />
        </div>
        <div className="space-y-3">
          <div className="h-[260px]">
            <PlotlyChart figure={bars} title="Per-class Metrics" className="animate-chart-in" />
          </div>
          {hist ? (
            <div className="h-[220px]">
              <PlotlyChart figure={hist} title="Confidence Distribution" className="animate-chart-in" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default EvaluationAnalytics;
