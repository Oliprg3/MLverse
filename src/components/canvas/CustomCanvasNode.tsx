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
    <span className="inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-md border border-neutral-200/80 bg-neutral-100/60 px-1.5 py-0.5 font-mono text-[9.5px] leading-none text-neutral-500 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-zinc-400">
      <span className="shrink-0 opacity-60">{label}</span>
      <span className="mx-1 shrink-0 opacity-30">=</span>
      <span className="min-w-0 truncate font-semibold text-neutral-800 dark:text-zinc-200">{value}</span>
    </span>
  );
}

function CustomCanvasNodeBase({ id, data, selected }: NodeProps<CustomFlowNode>) {
  const { deleteElements } = useReactFlow();
  const category = getCategory(data.category);
  const Icon = resolveIcon(data.icon);

  const isCsv = data.type === "data:csv";
  const isImage = data.type === "data:images";
  const csv = data.dataset as CsvDataset | undefined;
  const images = data.imageDataset as ImageDataset | undefined;
  const running = data.executionStatus === "running";

  return (
    <div
      className={cn(
        "nf-node-shell nf-node-corners group relative w-[252px] rounded-xl p-3.5",
        running && "border-sky-400/50 dark:border-sky-400/40",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Delete control */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Delete node"
        title="Delete node"
        className={cn(
          "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100",
          selected && "opacity-100",
        )}
      >
        <Trash size={13} />
      </button>

      {/* Execution status */}
      {running ? (
        <span
          className="absolute right-9 top-2 inline-flex items-center gap-1 rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-500 dark:text-sky-400"
          title="Running"
        >
          <CircleNotch size={10} className="animate-spin" /> run
        </span>
      ) : data.executionStatus === "success" ? (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-500" title="Succeeded">
          <CheckCircle size={10} weight="fill" /> ok
        </span>
      ) : data.executionStatus === "error" ? (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-500" title="Failed">
          <XCircle size={10} weight="fill" /> err
        </span>
      ) : null}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-transparent dark:border-white/[0.1]">
          <Icon size={17} weight="regular" className="text-neutral-500 dark:text-zinc-400" />
        </div>
        <div className="min-w-0 pr-6">
          <h3 className="truncate text-[13px] font-semibold leading-tight tracking-tight text-neutral-900 dark:text-white">{data.label}</h3>
          <p className="nf-hud-label mt-1 !text-[8.5px]">{category.label}</p>
        </div>
      </div>

      {/* Body */}
      <div className="mt-3">
        {isCsv ? (
          csv ? (
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <FileCsv size={14} weight="regular" className="shrink-0 text-neutral-400 dark:text-zinc-500" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-neutral-700 dark:text-zinc-300">{csv.filename}</div>
                <div className="font-mono text-[9.5px] text-neutral-400 dark:text-zinc-500">{csv.nrows.toLocaleString()} rows, {csv.columns.length} cols</div>
              </div>
              <span className="shrink-0 rounded-md border border-neutral-200/80 bg-white/60 px-1.5 py-0.5 font-mono text-[9px] font-medium text-neutral-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-400">{csv.targetColumn}</span>
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
                    <img key={i} src={src} alt="" className="aspect-square w-full rounded-md border border-neutral-200/70 object-cover dark:border-white/[0.08]" />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <FileCsv size={14} weight="regular" className="shrink-0 text-neutral-400 dark:text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-neutral-700 dark:text-zinc-300">{images.nsamples} images</div>
                  <div className="font-mono text-[9.5px] text-neutral-400 dark:text-zinc-500">{images.width}×{images.height}, {images.classNames.length} classes</div>
                </div>
              </div>
            </div>
          ) : (
            <UploadHint icon={<CloudArrowUp size={14} />} text="Click to import images" />
          )
        ) : data.description ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-neutral-400 dark:text-zinc-500">{data.description}</p>
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
    <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2.5 py-2 text-[11px] text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-500 dark:border-white/[0.12] dark:text-zinc-500 dark:hover:border-white/25 dark:hover:text-zinc-400">
      {icon}{text}
    </div>
  );
}

export const CustomCanvasNode = memo(CustomCanvasNodeBase);
export default CustomCanvasNode;
