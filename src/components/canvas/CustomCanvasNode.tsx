"use client";

/* Dynamic icons are resolved from serialized canvas metadata by design. */
/* eslint-disable react-hooks/static-components */

import { memo } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { CheckCircle, CircleNotch, Trash, CloudArrowUp, FileCsv, XCircle } from "@phosphor-icons/react";
import { resolveIcon } from "@/lib/icons";
import { getCategory } from "@/lib/canvasConfig";
import type { CsvDataset, ImageDataset, MLNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CustomFlowNode = Node<MLNodeData, "custom">;

function ParamPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10px] leading-none text-muted-2">
      <span className="text-muted">{label}</span>
      <span className="mx-1 opacity-30">·</span>
      <span className="text-foreground-2">{value}</span>
    </span>
  );
}

function CustomCanvasNodeBase({ id, data, selected }: NodeProps<CustomFlowNode>) {
  const { deleteElements } = useReactFlow();
  const category = getCategory(data.category);
  const accent = category.accent;
  const Icon = resolveIcon(data.icon);

  const isCsv = data.type === "data:csv";
  const isImage = data.type === "data:images";
  const csv = data.dataset as CsvDataset | undefined;
  const images = data.imageDataset as ImageDataset | undefined;

  return (
    <div
      className={cn(
        "nf-node-shell group relative w-[232px] rounded-2xl border bg-surface p-3.5 transition-all duration-200",
        selected
          ? "border-primary/40 shadow-lg shadow-primary/10"
          : "border-border hover:border-border-strong hover:shadow-md",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-[3px] rounded-full transition-all duration-200"
        style={{ background: selected ? accent : `color-mix(in srgb, ${accent} 60%, transparent)` }}
      />

      {/* Delete control */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Delete node"
        title="Delete node"
        className={cn(
          "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-400",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Trash size={13} />
      </button>

      {/* Execution status */}
      {data.executionStatus === "running" ? (
        <span className="absolute right-9 top-2 flex items-center gap-1 rounded-lg bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-sky-400" title="Running">
          <CircleNotch size={11} className="animate-spin" /> run
        </span>
      ) : data.executionStatus === "success" ? (
        <CheckCircle size={14} weight="fill" className="absolute bottom-2.5 right-2.5 text-primary" aria-label="Succeeded" />
      ) : data.executionStatus === "error" ? (
        <XCircle size={14} weight="fill" className="absolute bottom-2.5 right-2.5 text-rose-500" aria-label="Failed" />
      ) : null}

      {/* Header */}
      <div className="flex items-center gap-2.5 pl-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)` }}>
          <Icon size={16} weight="regular" style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold leading-tight tracking-tight text-foreground">{data.label}</h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{category.label}</p>
        </div>
      </div>

      {/* Body */}
      <div className="mt-3 pl-2">
        {isCsv ? (
          csv ? (
            <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-2.5 py-2">
              <FileCsv size={14} weight="regular" className="shrink-0 text-muted-2" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-foreground-2">{csv.filename}</div>
                <div className="font-mono text-[9.5px] text-muted">{csv.nrows.toLocaleString()} rows · {csv.columns.length} cols</div>
              </div>
              <span className="rounded-lg bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-2">{csv.targetColumn}</span>
            </div>
          ) : (
            <UploadHint icon={<CloudArrowUp size={14} />} text="Click to import CSV" />
          )
        ) : isImage ? (
          images ? (
            <div className="space-y-1.5">
              {images.thumbnails.length > 0 ? (
                <div className="grid grid-cols-4 gap-1">
                  {images.thumbnails.slice(0, 4).map((src, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={i} src={src} alt="" className="aspect-square w-full rounded-lg border border-border object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-2.5 py-2">
                <FileCsv size={14} weight="regular" className="shrink-0 text-muted-2" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-foreground-2">{images.nsamples} images</div>
                  <div className="font-mono text-[9.5px] text-muted">{images.width}×{images.height} · {images.classNames.length} classes</div>
                </div>
              </div>
            </div>
          ) : (
            <UploadHint icon={<CloudArrowUp size={14} />} text="Click to import images" />
          )
        ) : data.description ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-2">{data.description}</p>
        ) : null}

        {data.params && data.params.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {data.params.slice(0, 4).map((p) => (
              <ParamPill key={p.key} label={p.key} value={p.value} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UploadHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-2 transition-colors hover:border-border-strong hover:text-muted">
      {icon}{text}
    </div>
  );
}

export const CustomCanvasNode = memo(CustomCanvasNodeBase);
export default CustomCanvasNode;
