"use client";

/* Dynamic icons are resolved from serialized canvas metadata by design. */
/* eslint-disable react-hooks/static-components */

import { useRef, type ChangeEvent } from "react";
import Papa from "papaparse";
import { useReactFlow } from "@xyflow/react";
import {
  CaretRight,
  Folder,
  Images,
  SlidersHorizontal,
  Target,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/canvasConfig";
import { chartsInGroup, CHART_GROUPS, parseChartSelection, serializeChartSelection } from "@/lib/chartCatalog";
import { resolveIcon } from "@/lib/icons";
import type { CsvDataset, ImageDataset, MLNodeData, NodeParam } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InspectorProps {
  node: { id: string; data: MLNodeData } | null;
  onClose: () => void;
}

const IMG_SIZE = 18;
const MAX_PER_CLASS = 40;
const MAX_TOTAL = 120;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
async function fileToVector(file: File, size: number): Promise<{ vector: number[]; thumb: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const vector: number[] = [];
    for (let i = 0; i < data.length; i += 4) vector.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    return { vector, thumb: canvas.toDataURL("image/jpeg", 0.6) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
function classOfFile(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  const p = rel && rel.includes("/") ? rel : file.name;
  const parts = p.split("/");
  if (parts.length >= 2) return parts[parts.length - 2].trim() || "class";
  return file.name.replace(/\.[^.]+$/, "").split(/[_\-\s]/)[0].trim() || "class";
}
async function processImageFiles(files: FileList | File[]): Promise<ImageDataset | null> {
  const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
  if (!all.length) return null;
  const groups = new Map<string, File[]>();
  for (const f of all) {
    const cls = classOfFile(f);
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls)!.push(f);
  }
  const classNames = Array.from(groups.keys()).sort();
  const labels: number[] = [];
  const vectors: number[][] = [];
  const thumbnails: string[] = [];
  let total = 0;
  for (let ci = 0; ci < classNames.length; ci++) {
    let addedThumb = false;
    for (const f of groups.get(classNames[ci])!.slice(0, MAX_PER_CLASS)) {
      if (total >= MAX_TOTAL) break;
      try {
        const { vector, thumb } = await fileToVector(f, IMG_SIZE);
        vectors.push(vector);
        labels.push(ci);
        if (!addedThumb) {
          thumbnails.push(thumb);
          addedThumb = true;
        }
        total++;
      } catch {
        /* skip */
      }
    }
    if (total >= MAX_TOTAL) break;
  }
  if (!vectors.length) return null;
  return { name: "Image Dataset", classNames, labels, vectors, width: IMG_SIZE, height: IMG_SIZE, nsamples: vectors.length, thumbnails: thumbnails.slice(0, 8) };
}

export function Inspector({ node, onClose }: InspectorProps) {
  const { updateNodeData } = useReactFlow();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageFolderRef = useRef<HTMLInputElement>(null);
  const imageFilesRef = useRef<HTMLInputElement>(null);

  if (!node) return null;
  const data = node.data;
  const category = getCategory(data.category);
  const Icon = resolveIcon(data.icon);
  const isCsv = data.type === "data:csv";
  const isImages = data.type === "data:images";

  const handleCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    const columns = (parsed.meta.fields ?? []).filter(Boolean);
    if (!columns.length) return;
    const dataset: CsvDataset = {
      filename: file.name,
      targetColumn: columns.find((c) => /^(target|label|class|category|outcome|y|dependent|diagnosis)$/i.test(c.trim())) ?? columns[columns.length - 1],
      columns,
      nrows: parsed.data.length,
      csvText,
    };
    updateNodeData(node.id, {
      dataset,
      label: file.name.replace(/\.[^.]+$/, "") || "Custom CSV",
      description: `${dataset.nrows.toLocaleString()} rows · ${columns.length} cols · target: ${dataset.targetColumn}`,
    });
    e.target.value = "";
  };

  const handleImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const dataset = await processImageFiles(files);
    if (!dataset) return;
    const counts = dataset.classNames.map((c, i) => `${c}:${dataset.labels.filter((l) => l === i).length}`).join(" · ");
    updateNodeData(node.id, {
      imageDataset: dataset,
      label: "Image Dataset",
      description: `${dataset.nsamples} images · ${dataset.classNames.length} classes (${counts})`,
    });
    e.target.value = "";
  };

  const updateParam = (key: string, value: string | number) => {
    const params: NodeParam[] = (data.params ?? []).map((p) => (p.key === key ? { ...p, value } : p));
    updateNodeData(node.id, { params });
  };

  const updateCsvTarget = (targetColumn: string) => {
    if (!data.dataset) return;
    updateNodeData(node.id, {
      dataset: { ...data.dataset, targetColumn },
      description: `${data.dataset.nrows.toLocaleString()} rows · ${data.dataset.columns.length} cols · target: ${targetColumn}`,
    });
  };

  return (
    <aside className="animate-slide-up flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface/70 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-2">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Node Settings
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close inspector">
          ✕
        </Button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        {/* Identity — bare icon glyph */}
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 shrink-0" style={{ color: category.accent }} strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">{data.label}</div>
            <div className="text-[11px] text-muted-2">{category.label}</div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-2">{data.description}</p>

        {/* CSV */}
        {isCsv ? (
          <section className="mt-5 space-y-3">
            <SectionLabel icon={<UploadSimple size={14} />}>Dataset</SectionLabel>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
            <Button variant="default" className="w-full" onClick={() => csvInputRef.current?.click()}>
              <UploadSimple size={16} />
              {data.dataset ? "Replace CSV" : "Upload CSV file"}
            </Button>
            {data.dataset ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card-2/50 p-3">
                  <div className="truncate text-xs font-medium text-foreground-2">{data.dataset.filename}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">{data.dataset.nrows.toLocaleString()} rows · {data.dataset.columns.length} features</div>
                </div>
                <div>
                  <SectionLabel icon={<Target className="h-3.5 w-3.5" />}>Target column</SectionLabel>
                  <select
                    value={data.dataset.targetColumn}
                    onChange={(e) => updateCsvTarget(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {data.dataset.columns.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card-2/40 p-3 text-xs leading-relaxed text-muted-2">
                Upload a CSV with a header row. The last column (or one named target / label / class) is auto-selected as the prediction target.
              </p>
            )}
          </section>
        ) : null}

        {/* Images */}
        {isImages ? (
          <section className="mt-5 space-y-3">
            <SectionLabel icon={<Images className="h-3.5 w-3.5" />}>Image dataset</SectionLabel>
            <input
              ref={(el) => { imageFolderRef.current = el; if (el) el.setAttribute("webkitdirectory", ""); }}
              type="file" accept="image/*" multiple className="hidden" onChange={handleImages}
            />
            <input ref={imageFilesRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="default" onClick={() => imageFolderRef.current?.click()} title="Pick a folder where each sub-folder is a class"><Folder size={16} /> Folder</Button>
              <Button variant="default" onClick={() => imageFilesRef.current?.click()} title="Pick files named like class_001.jpg"><UploadSimple size={16} /> Files</Button>
            </div>
            {data.imageDataset ? (
              <div className="space-y-3">
                {data.imageDataset.thumbnails.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {data.imageDataset.thumbnails.slice(0, 8).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="aspect-square w-full rounded border border-border object-cover" />
                    ))}
                  </div>
                ) : null}
                <div className="rounded-lg border border-border bg-card-2/50 p-3">
                  <div className="font-mono text-[11px] text-muted-2">{data.imageDataset.nsamples} samples · {data.imageDataset.width}×{data.imageDataset.height} · {data.imageDataset.classNames.length} classes</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.imageDataset.classNames.map((c, i) => {
                      const count = data.imageDataset!.labels.filter((l) => l === i).length;
                      return (<span key={c} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-2">{c} · {count}</span>);
                    })}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-2">Instant path trains a grayscale baseline on the CPU. For a CNN, add a Deep Learning node to export a Colab notebook.</p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card-2/40 p-3 text-xs leading-relaxed text-muted-2">
                Pick a <span className="font-medium text-foreground-2">folder</span> where each sub-folder is a class, or pick <span className="font-medium text-foreground-2">files</span> named like <code>class_001.jpg</code>.
              </p>
            )}
          </section>
        ) : null}

        {/* Parameters */}
        {data.params && data.params.length > 0 ? (
          <section className="mt-5 space-y-3">
            <SectionLabel icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>Parameters</SectionLabel>
            {data.params.map((p) => (<ParamRow key={p.key} param={p} onChange={(v) => updateParam(p.key, v)} />))}
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-2">
      {icon}{children}
    </div>
  );
}

function ParamRow({ param, onChange }: { param: NodeParam; onChange: (value: string | number) => void }) {
  const isNumber = typeof param.value === "number";
  if (param.kind === "charts" && param.chartGroup) {
    const selected = new Set(parseChartSelection(param.value));
    const group = CHART_GROUPS[param.chartGroup];
    return (
      <fieldset className="min-w-0">
        <legend className="mb-1 block max-w-full text-xs font-medium tracking-tight text-foreground-2">{param.label}</legend>
        <div className="overflow-hidden rounded-lg border border-border bg-background/50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-foreground/[0.03] px-2.5 py-2">
            <span className="min-w-0 text-[10px] leading-relaxed text-muted">{group.description}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-2">{selected.size}/{chartsInGroup(param.chartGroup).length}</span>
          </div>
          <div className="divide-y divide-border/60">
            {chartsInGroup(param.chartGroup).map((chart) => (
              <label key={chart.key} className="flex min-w-0 cursor-pointer items-start gap-2 px-2.5 py-2 transition-colors hover:bg-foreground/[0.04]">
                <input
                  type="checkbox"
                  checked={selected.has(chart.key)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(chart.key);
                    else next.delete(chart.key);
                    onChange(serializeChartSelection([...next]));
                  }}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-500"
                />
                <span className="min-w-0">
                  <span className="block break-words text-[11px] font-medium text-foreground-2">{chart.short}</span>
                  <span className="block break-words text-[10px] leading-relaxed text-muted">{chart.subtitle}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {param.hint ? <span className="mt-1 block break-words text-[11px] text-muted">{param.hint}</span> : null}
      </fieldset>
    );
  }
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="max-w-full break-words text-xs font-medium tracking-tight text-foreground-2">{param.label}</span>
        {param.kind === "slider" ? <span className="shrink-0 font-mono text-[11px] text-muted">{String(param.value)}</span> : null}
      </span>
      {param.kind === "toggle" ? (
        <button
          type="button"
          role="switch"
          aria-checked={param.value === "true"}
          onClick={() => onChange(param.value === "true" ? "false" : "true")}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
            param.value === "true" ? "border-emerald-500/60 bg-emerald-500/80" : "border-border bg-background",
          )}
        >
          <span className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all", param.value === "true" ? "left-[1.15rem]" : "left-0.5")} />
        </button>
      ) : param.kind === "slider" && typeof param.min === "number" && typeof param.max === "number" ? (
        <span className="flex items-center gap-2">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step ?? 1}
            value={Number(param.value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/[0.12] accent-emerald-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
          />
          <input
            type="number"
            min={param.min}
            max={param.max}
            step={param.step ?? 1}
            value={Number(param.value)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) onChange(Math.min(param.max!, Math.max(param.min!, next)));
            }}
            className="w-16 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-right font-mono text-[11px] text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </span>
      ) : param.options ? (
        <select value={String(param.value)} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {param.options.map((o) => (<option key={o} value={o}>{o}</option>))}
        </select>
      ) : (
        <input
          type={isNumber ? "number" : "text"}
          step={isNumber && typeof param.value === "number" && param.value < 1 ? 0.05 : 1}
          value={String(param.value)}
          onChange={(e) => onChange(isNumber ? Number(e.target.value) : e.target.value)}
          className="w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      {param.hint ? <span className="mt-1 block break-words text-[11px] text-muted">{param.hint}</span> : null}
    </label>
  );
}

export default Inspector;


