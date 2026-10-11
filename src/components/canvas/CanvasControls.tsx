"use client";

import { Controls, MiniMap, useReactFlow } from "@xyflow/react";
import { CornersIn, CornersOut } from "@phosphor-icons/react";

/**
 * Floating glassmorphism controls + minimap for the canvas.
 *
 * The visual styling (glass blur, accent hovers, dark minimap) is defined in
 * `globals.css` via React Flow class overrides; this component wires the
 * behaviour and keeps node colouring neutral.
 */
export function CanvasControls({ focusMode = false, onToggleFocus }: { focusMode?: boolean; onToggleFocus?: () => void }) {
  return (
    <>
      {onToggleFocus ? (
        <button
          type="button"
          onClick={onToggleFocus}
          aria-pressed={focusMode}
          title={focusMode ? "Exit full screen (Esc)" : "Full screen graph — hide side panels (Esc)"}
          aria-label={focusMode ? "Exit full screen graph" : "Show graph full screen"}
          className="absolute left-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white/90 px-2.5 text-[11px] font-medium text-neutral-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-neutral-900 dark:border-white/[0.08] dark:bg-[#0a0a0d]/80 dark:text-zinc-400 dark:hover:bg-[#121218] dark:hover:text-white"
        >
          {focusMode ? <CornersIn size={13} /> : <CornersOut size={13} />}
          {focusMode ? "Exit full screen" : "Full screen"}
        </button>
      ) : null}
      <Controls
        position="bottom-left"
        showInteractive={false}
        className="!rounded-xl"
        aria-label="Canvas controls"
      />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        ariaLabel="Canvas minimap"
        nodeColor={() => "var(--muted-2)"}
        nodeStrokeColor={() => "var(--border-strong)"}
        nodeStrokeWidth={1.5}
        nodeBorderRadius={2}
      />
    </>
  );
}

export default CanvasControls;

/** Floating action to re-center the whole graph (used by the header fit button). */
export function useFitView() {
  const { fitView } = useReactFlow();
  return () => fitView({ padding: 0.28, duration: 450 });
}
