"use client";

import { Controls, MiniMap, useReactFlow, type Node } from "@xyflow/react";
import type { MLNodeData } from "@/lib/types";

/**
 * Floating glassmorphism controls + minimap for the canvas.
 *
 * The visual styling (glass blur, accent hovers, dark minimap) is defined in
 * `globals.css` via React Flow class overrides; this component wires the
 * behaviour and node colouring.
 */
export function CanvasControls() {
  return (
    <>
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
        nodeColor={(n: Node) => {
          const accent = (n.data as MLNodeData | undefined)?.accent;
          return accent ?? "#64748b";
        }}
        nodeStrokeColor={(n: Node) => {
          const accent = (n.data as MLNodeData | undefined)?.accent;
          return accent ? `color-mix(in srgb, ${accent} 60%, transparent)` : "#64748b";
        }}
        nodeStrokeWidth={3}
        nodeBorderRadius={6}
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
