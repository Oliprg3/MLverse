"use client";

import { Controls, MiniMap, useReactFlow } from "@xyflow/react";

/**
 * Floating glassmorphism controls + minimap for the canvas.
 *
 * The visual styling (glass blur, accent hovers, dark minimap) is defined in
 * `globals.css` via React Flow class overrides; this component wires the
 * behaviour and keeps node colouring neutral.
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
