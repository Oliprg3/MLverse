"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Clock,
  Code,
  DownloadSimple,
  ArrowSquareOut,
  FileText,
  Package,
  Pulse,
  Table,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { TerminalConsole, type TerminalLine } from "./TerminalConsole";
import { EvaluationAnalytics } from "./EvaluationAnalytics";
import { PlotlyChart } from "./PlotlyChart";
import type { PlotlyFigure } from "@/lib/types";
import { chartSpec, sortChartKeys } from "@/lib/chartCatalog";
import { cn, formatPercent } from "@/lib/utils";
import type {
  ColabExecutionResponse,
  ExecutionResponse,
  InstantExecutionResponse,
  MetricSet,
  PipelineStep,
  PredictionSet,
} from "@/lib/types";

interface ResultsDrawerProps {
  open: boolean;
  loading: boolean;
  logs: TerminalLine[];
  liveMetrics: Record<string, number>;
  response: ExecutionResponse | null;
  onClose: () => void;
  onViewCode?: () => void;
  onOpenColab?: () => void;
  code?: string;
}

const METRIC_META: { key: keyof MetricSet; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "roc_auc", label: "ROC-AUC" },
  { key: "f1", label: "F1 Score" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "average_precision", label: "Avg. Precision" },
];

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="animate-chart-in rounded-lg border border-border bg-surface p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className={cn("mt-1 font-mono text-xl font-bold tabular-nums", value === null && "text-muted/40")}>
        {value === null ? "n/a" : formatPercent(value)}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, figure }: { title: string; subtitle?: string; figure?: PlotlyFigure }) {
  return (
    <div className="animate-chart-in flex flex-col rounded-xl border border-border bg-surface p-3">
      <div className="mb-1">
        <h4 className="text-sm font-semibold tracking-tight text-foreground">{title}</h4>
        {subtitle ? <p className="text-[11px] text-muted">{subtitle}</p> : null}
      </div>
      <div className="h-[300px] w-full flex-1">
        {figure ? <PlotlyChart figure={figure} title={title} /> : <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-foreground/[0.02] text-xs text-muted">No figure returned for this chart</div>}
      </div>
    </div>
  );
}

function PipelineStrip({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="rounded-md border border-border bg-foreground/[0.04] px-2 py-1 text-[11px] font-medium text-foreground-2">{step.name}</span>
          {i < steps.length - 1 ? <span className="text-muted/50">→</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Live training console shown while the stream is running. */
function LiveConsole({ logs, liveMetrics, running }: { logs: TerminalLine[]; liveMetrics: Record<string, number>; running: boolean }) {
  const epochState = useMemo(() => {
    let current = 0;
    let total = 0;
    let loss: number | null = null;
    let accuracy: number | null = null;
    for (const log of logs) {
      const match = log.text.match(/epoch\s+(\d+)(?:\s*\/\s*(\d+))?.*loss[=:]\s*([\d.]+).*?(?:val_acc|acc)[=:]\s*([\d.]+)/i);
      if (!match) continue;
      current = Number(match[1]);
      total = Number(match[2] ?? total);
      loss = Number(match[3]);
      accuracy = Number(match[4]);
    }
    return { current, total, loss, accuracy };
  }, [logs]);

  return (
    <div className="space-y-4">
      {epochState.current > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 font-medium text-foreground"><CircleNotch size={14} className="animate-spin text-sky-400" /> Epoch {epochState.current}{epochState.total ? ` / ${epochState.total}` : ""}</span>
            <span className="font-mono text-muted-2">{epochState.loss === null ? "loss pending" : `loss ${epochState.loss.toFixed(4)}`} <span className="opacity-40">|</span> {epochState.accuracy === null ? "accuracy pending" : `${(epochState.accuracy * 100).toFixed(1)}% val acc`}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.08]"><div className="h-full rounded-full bg-sky-400 transition-all duration-500" style={{ width: `${epochState.total ? Math.min(100, (epochState.current / epochState.total) * 100) : 100}%` }} /></div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_META.map((m) => (
          <MetricCard key={m.key} label={m.label} value={m.key in liveMetrics ? liveMetrics[m.key] : null} />
        ))}
      </div>
      <TerminalConsole lines={logs} running={running} />
    </div>
  );
}

/** Scrollable results table + CSV/JSON export. */
function PredictionsTable({ preds }: { preds: PredictionSet }) {
  const rows = Math.min(preds.y_true.length, preds.y_pred.length, 50);
  const classes = preds.classes;

  const exportCsv = () => {
    const n = Math.min(preds.y_true.length, preds.y_pred.length);
    const lines = ["index,actual,predicted,correct"];
    for (let i = 0; i < n; i++) {
      const t = classes[preds.y_true[i]] ?? preds.y_true[i];
      const p = classes[preds.y_pred[i]] ?? preds.y_pred[i];
      lines.push(`${i},${t},${p},${preds.y_true[i] === preds.y_pred[i] ? "yes" : "no"}`);
    }
    downloadBlob("predictions.csv", lines.join("\n"), "text/csv");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-foreground/[0.03] px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground-2"><Table size={16} weight="regular" className="h-3.5 w-3.5" /> Test predictions</span>
        <Button variant="ghost" size="sm" onClick={exportCsv}><DownloadSimple size={16} /> CSV</Button>
      </div>
      <div className="scroll-thin max-h-72 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Predicted</th>
              <th className="px-3 py-2 font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const actual = classes[preds.y_true[i]] ?? preds.y_true[i];
              const pred = classes[preds.y_pred[i]] ?? preds.y_pred[i];
              const correct = preds.y_true[i] === preds.y_pred[i];
              return (
                <tr key={i} className="border-t border-border/60 font-mono">
                  <td className="px-3 py-1.5 text-muted">{i + 1}</td>
                  <td className="px-3 py-1.5 text-foreground-2">{actual}</td>
                  <td className={cn("px-3 py-1.5", correct ? "text-emerald-400" : "text-rose-400")}>{pred}</td>
                  <td className="px-3 py-1.5">{correct ? <Check size={13} weight="bold" className="text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-foreground/[0.02] px-3 py-1.5 text-[10.5px] text-muted">
        Showing {rows} of {preds.n_test} test samples, download CSV for all {preds.n_test}
      </div>
    </div>
  );
}

function saveBase64Artifact(filename: string, base64: string, mime: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ModelExportBar({ res }: { res: InstantExecutionResponse }) {
  const artifacts = (res.model as typeof res.model & { artifacts?: Record<string, { filename: string; mime: string; base64?: string } | null> }).artifacts ?? {};
  const [format, setFormat] = useState<"pickle" | "joblib">("pickle");
  const [saved, setSaved] = useState(false);
  const download = () => {
    const artifact = artifacts[format];
    if (!artifact?.base64) return;
    saveBase64Artifact(artifact.filename, artifact.base64, artifact.mime);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Package className="h-4 w-4 text-emerald-400" /> Model artifact ready</div>
          <p className="mt-1 text-[11px] text-muted-2">Download the fitted preprocessing pipeline and trained model for reuse in Python.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select value={format} onChange={(event) => setFormat(event.target.value as "pickle" | "joblib")} className="h-8 max-w-40 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400/40" aria-label="Model export format">
            <option value="pickle">Python pickle (.pkl)</option>
            <option value="joblib">Joblib (.joblib)</option>
          </select>
          <Button variant="default" size="sm" onClick={download} disabled={!artifacts[format]?.base64}><DownloadSimple size={16} /> {saved ? "Saved" : "Save model"}</Button>
        </div>
      </div>
    </div>
  );
}

function InstantView({ res, onViewCode }: { res: InstantExecutionResponse; onViewCode?: () => void }) {
  const report = () => {
    const payload = {
      model: res.model,
      dataset: res.dataset,
      metrics: res.metrics,
      pipeline: res.pipeline,
      predictions: res.predictions,
      timing: res.timing,
    };
    downloadBlob("datlify-results.json", JSON.stringify(payload, null, 2), "application/json");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
          <span className="inline-flex items-center gap-1.5"><Package size={14} className="text-emerald-400" /> Instant CPU execution</span>
          <span className="inline-flex items-center gap-1.5"><Package size={14} /> {res.model.framework}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} className="h-3.5 w-3.5" /> {(res.timing.total_seconds ?? 0).toFixed(2)}s</span>
        </div>
        <div className="flex items-center gap-2">
          {onViewCode ? <Button variant="ghost" size="sm" onClick={onViewCode}><Code size={16} /> Code</Button> : null}
          <Button variant="ghost" size="sm" onClick={report}><DownloadSimple size={16} /> JSON</Button>
        </div>
      </div>

      <PipelineStrip steps={res.pipeline.steps} />
      <ModelExportBar res={res} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_META.map((m) => (
          <MetricCard key={m.key} label={m.label} value={res.metrics[m.key] ?? 0} />
        ))}
      </div>

      <EvaluationAnalytics predictions={res.predictions} />

      {(() => {
        const requested = sortChartKeys(res.charts_requested?.length ? res.charts_requested : Object.keys(res.charts));
        return requested.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {requested.map((key) => {
              const spec = chartSpec(key);
              if (!spec) return null;
              return <ChartCard key={key} title={spec.label} subtitle={spec.subtitle} figure={res.charts[key as keyof typeof res.charts]} />;
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-foreground/[0.02] px-5 py-10 text-center">
            <Pulse size={14} className="mx-auto h-5 w-5 text-muted-2" />
            <p className="mt-2 text-sm font-medium text-foreground-2">No visualizations selected</p>
            <p className="mt-1 text-xs text-muted">Choose charts in the visualization node before running the pipeline.</p>
          </div>
        );
      })()}

      {res.predictions && res.predictions.y_true.length > 0 ? <PredictionsTable preds={res.predictions} /> : null}
    </div>
  );
}

function StepBadge({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", done ? "bg-emerald-500/15 text-emerald-400" : "bg-foreground/[0.06] text-muted")}>
        {done ? "✓" : n}
      </span>
      <span className="text-[12px] text-foreground-2">{label}</span>
    </div>
  );
}

function ColabView({ res, onViewCode, onOpenColab, code }: { res: ColabExecutionResponse; onViewCode?: () => void; onOpenColab?: () => void; code?: string }) {
  const [copied, setCopied] = useState(false);
  const fullCode = useMemo(() => {
    if (code) return code;
    try {
      const nb = JSON.parse(res.notebook_json);
      return (nb.cells as Array<{ cell_type: string; source: string[] | string }>)
        .filter((c) => c.cell_type === "code")
        .map((c) => (Array.isArray(c.source) ? c.source.join("") : c.source))
        .join("\n\n");
    } catch {
      return "";
    }
  }, [res.notebook_json, code]);
  const preview = useMemo(() => fullCode.split("\n").slice(0, 44).join("\n"), [fullCode]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(fullCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const sizeKb = (res.notebook.size_bytes / 1024).toFixed(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-2">
          <span className="inline-flex items-center gap-1.5"><Package size={14} className="text-indigo-300" /> Notebook ready</span>
          <span className="text-muted">{res.recommended_runtime}</span>
        </div>
        <div className="flex items-center gap-2">
          {onViewCode ? <Button variant="ghost" size="sm" onClick={onViewCode}><Code size={16} /> Code</Button> : null}
          <Button variant="default" size="sm" onClick={() => downloadBlob(res.notebook.filename, res.notebook_json, "application/x-ipynb+json")}>
            <DownloadSimple size={16} /> Save training notebook
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-foreground">Open in Google Colab</h4>
            <p className="mt-0.5 text-[12px] text-muted-2">Opens a fresh notebook and copies the full training code, ready to paste into the first cell.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {onOpenColab ? (
              <Button variant="colab" size="sm" onClick={onOpenColab}><ArrowSquareOut size={16} /> Open Colab &amp; Copy Code</Button>
            ) : (
              <a href={res.colab_url} target="_blank" rel="noopener noreferrer"><Button variant="colab" size="sm"><ArrowSquareOut size={16} /> Open Colab</Button></a>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
          <StepBadge n={1} label="Colab opens in a new tab" done />
          <StepBadge n={2} label="Training code copied to clipboard" done />
          <StepBadge n={3} label="Paste (⌘V / Ctrl+V) into a cell" done={false} />
          <StepBadge n={4} label="Runtime → Run all on a GPU" done={false} />
        </div>
      </div>

      <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Package className="h-4 w-4 text-sky-400" /> Deep-learning exports included</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-2">Run the export cell in Colab after training to save native PyTorch weights, TorchScript, and a portable ONNX graph for deployment.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[".pth", ".ts", ".onnx"].map((extension) => <span key={extension} className="rounded-md border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] text-sky-300">{extension}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"><FileText className="h-4 w-4 text-muted-2" /> {res.notebook.filename}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-2">
            <span className="rounded-md border border-border bg-foreground/[0.04] px-2 py-0.5">{res.notebook.cells} cells</span>
            <span className="rounded-md border border-border bg-foreground/[0.04] px-2 py-0.5">{sizeKb} KB</span>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">GPU accelerator</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-2">Includes GPU checks (<code className="text-sky-400">torch.cuda.is_available()</code>), PyTorch training loops, 🤗 Transformers fine-tuning, and matplotlib/seaborn plots.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Detected nodes</div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {res.nodes_detected.map((n) => (<span key={n} className="rounded-md border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">{n}</span>))}
          </div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Requirements</div>
          <div className="flex flex-wrap gap-1.5">
            {res.requirements.map((r) => (<span key={r} className="rounded-md border border-border bg-foreground/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-2">{r}</span>))}
          </div>
        </div>
      </div>

      {preview ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-foreground/[0.03] px-3 py-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-2"><ClipboardText size={12} /> generated code (paste into Colab)</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyCode}>
                {copied ? <Check size={15} weight="bold" className="text-emerald-400" /> : <ClipboardText size={15} />}{copied ? "Copied" : "Copy"}
              </Button>
              {onViewCode ? <Button variant="ghost" size="sm" onClick={onViewCode}>View full</Button> : null}
            </div>
          </div>
          <pre className="scroll-thin max-h-64 overflow-auto bg-foreground/[0.02] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-foreground-2">{preview}</pre>
        </div>
      ) : null}
    </div>
  );
}

export function ResultsDrawer({ open, loading, logs, liveMetrics, response, onClose, onViewCode, onOpenColab, code }: ResultsDrawerProps) {
  const route = response?.route ?? "instant";
  const isError = response?.status === "error";

  const successMeta = useMemo(() => {
    if (!response || response.status !== "success") return null;
    if (response.route === "instant") {
      const r = response as InstantExecutionResponse;
      return `${r.model.name} on ${r.dataset.name}, ${(r.timing.total_seconds ?? 0).toFixed(2)}s`;
    }
    const r = response as ColabExecutionResponse;
    return `${r.notebook.filename}, ${r.notebook.cells} cells`;
  }, [response]);

  return (
    <>
      <div className={cn("absolute inset-0 z-20 bg-black/50 transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} />
      <div className={cn("absolute inset-x-0 bottom-0 z-30 flex max-h-[84%] flex-col overflow-hidden rounded-t-xl border-t border-border bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out", open ? "translate-y-0" : "translate-y-full")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="h-1 w-9 rounded-full bg-border-strong" />
            <div>
              <div className="flex items-center gap-2">
                {isError ? <XCircle size={15} weight="fill" className="text-rose-400" /> : loading ? <CircleNotch size={16} className="animate-spin text-muted-2" /> : <CheckCircle size={16} weight="fill" className="text-emerald-400" />}
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {loading ? (route === "colab" ? "Generating Colab notebook…" : "Training model…") : isError ? "Execution error" : route === "colab" ? "Colab Notebook Ready" : "Training Results & Dashboards"}
                </h3>
              </div>
              {successMeta ? <p className="font-mono text-[11px] text-muted">{successMeta}</p> : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close results"><XCircle className="h-5 w-5" /></Button>
        </div>

        <div className="scroll-thin overflow-y-auto px-5 py-4">
          {loading ? (
            <LiveConsole logs={logs} liveMetrics={liveMetrics} running={loading} />
          ) : isError && response ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-5">
              <div className="flex items-center gap-2 text-rose-400"><XCircle className="h-5 w-5" /><span className="text-sm font-semibold">The engine reported an error</span></div>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-foreground/[0.03] p-3 font-mono text-xs text-rose-300">{response.error ?? "Unknown error"}</pre>
              {response.engine ? <p className="mt-2 text-[11px] text-muted">Engine: {response.engine}</p> : null}
            </div>
          ) : response ? (
            response.route === "colab" ? (
              <ColabView res={response as ColabExecutionResponse} onViewCode={onViewCode} onOpenColab={onOpenColab} code={code} />
            ) : (
              <InstantView res={response as InstantExecutionResponse} onViewCode={onViewCode} />
            )
          ) : null}
        </div>
      </div>
    </>
  );
}

export default ResultsDrawer;




