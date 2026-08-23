"use client";

/* Dynamic icons are resolved from serialized canvas metadata by design. */
/* eslint-disable react-hooks/static-components */

import { memo } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { Trash2, UploadCloud, FileSpreadsheet } from "lucide-react";
import { resolveIcon } from "@/lib/icons";
import { getCategory } from "@/lib/canvasConfig";
import type { CsvDataset, ImageDataset, MLNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CustomFlowNode = Node<MLNodeData, "custom">;

function ParamPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-2">
      <span className="text-muted">{label}</span>
      <span className="mx-1 opacity-40">·</span>
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
        "nf-node-shell group relative w-[232px] rounded-xl border border-border bg-surface p-3 transition-colors duration-150",
        selected ? "border-border-strong" : "hover:border-border-strong",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Thin solid accent bar — subtle category cue, no gradient. */}
      <span aria-hidden className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-[2px] rounded-full" style={{ background: accent }} />

      {/* Delete control (utility button, not an icon container) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Delete node"
        title="Delete node"
        className={cn(
          "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition-all duration-150 hover:bg-foreground/[0.06] hover:text-rose-400",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Header — bare icon glyph (no box/border/tint) */}
      <div className="flex items-center gap-2.5 pl-2">
        <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: accent }} strokeWidth={1.75} />
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-tight tracking-tight text-foreground">{data.label}</h3>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">{category.label}</p>
        </div>
      </div>

      {/* Body */}
      <div className="mt-2.5 pl-2">
        {isCsv ? (
          csv ? (
            <div className="flex items-center gap-2 rounded-md bg-foreground/[0.04] px-2 py-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-2" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-foreground-2">{csv.filename}</div>
                <div className="font-mono text-[9.5px] text-muted">{csv.nrows.toLocaleString()} rows · {csv.columns.length} cols</div>
              </div>
              <span className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-2">{csv.targetColumn}</span>
            </div>
          ) : (
            <UploadHint icon={<UploadCloud className="h-3.5 w-3.5" />} text="Click to import CSV" />
          )
        ) : isImage ? (
          images ? (
            <div className="space-y-1.5">
              {images.thumbnails.length > 0 ? (
                <div className="grid grid-cols-4 gap-1">
                  {images.thumbnails.slice(0, 4).map((src, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={i} src={src} alt="" className="aspect-square w-full rounded border border-border object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-md bg-foreground/[0.04] px-2 py-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-2" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-foreground-2">{images.nsamples} images</div>
                  <div className="font-mono text-[9.5px] text-muted">{images.width}×{images.height} · {images.classNames.length} classes</div>
                </div>
              </div>
            </div>
          ) : (
            <UploadHint icon={<UploadCloud className="h-3.5 w-3.5" />} text="Click to import images" />
          )
        ) : data.description ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-2">{data.description}</p>
        ) : null}

        {data.params && data.params.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
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
    <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-2">
      {icon}{text}
    </div>
  );
}

export const CustomCanvasNode = memo(CustomCanvasNodeBase);
export default CustomCanvasNode;
