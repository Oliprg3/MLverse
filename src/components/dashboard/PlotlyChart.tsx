"use client";

import { useEffect, useRef } from "react";
import type { PlotlyFigure } from "@/lib/types";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

let plotlyLib: any = null;

const DOWNLOAD_ICON = {
  width: 448,
  height: 512,
  path: "M64 480 384 480 384 416 64 416 64 480zM224 416 224 256 320 256 224 128 128 256 224 256 224 416z",
  transform: "matrix(1 0 0 -1 0 512)",
};

function download(gd: HTMLElement, format: "png" | "svg") {
  if (!plotlyLib) return;
  const name = (gd.dataset.title ?? "chart").replace(/\s+/g, "_");
  plotlyLib.downloadImage(gd, { format, filename: name, scale: format === "png" ? 2 : 1 });
}

const BASE_CONFIG = {
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
  modeBarButtonsToAdd: [
    { name: "Download PNG", title: "Download as PNG", icon: DOWNLOAD_ICON, click: (gd: HTMLElement) => download(gd, "png") },
    { name: "Download SVG", title: "Download as SVG", icon: DOWNLOAD_ICON, click: (gd: HTMLElement) => download(gd, "svg") },
  ],
} as const;

/** Build theme-aware layout overrides that preserve the figure's own axis config. */
function buildThemedLayout(figure: PlotlyFigure, theme: "light" | "dark") {
  const grid = theme === "dark" ? "#1e2735" : "#e2e8f0";
  const tick = theme === "dark" ? "#94a3b8" : "#64748b";
  const font = theme === "dark" ? "#e2e8f0" : "#334155";
  const plotBg = theme === "dark" ? "#0e131c" : "#f8fafc";
  const layout = figure.layout ?? {};
  const axisPatch = { gridcolor: grid, linecolor: grid, zerolinecolor: grid, tickfont: { color: tick } } as const;

  return {
    ...layout,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: plotBg,
    font: { ...(layout.font as object), color: font, family: "Inter, ui-sans-serif, system-ui, sans-serif" },
    title: layout.title
      ? { ...(layout.title as object), font: { ...((layout.title as { font?: object }).font ?? {}), color: font } }
      : undefined,
    xaxis: { ...(layout.xaxis as object), ...axisPatch },
    yaxis: { ...(layout.yaxis as object), ...axisPatch },
  };
}

export interface PlotlyChartProps {
  figure: PlotlyFigure;
  title?: string;
  className?: string;
}

/**
 * Renders an arbitrary Plotly figure JSON inside Next.js. The ~3 MB plotly bundle
 * is imported dynamically and only on the client. Charts adapt to the active
 * theme and are fully interactive (hover, zoom, pan, PNG/SVG export).
 */
export function PlotlyChart({ figure, title, className }: PlotlyChartProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let active = true;
    (async () => {
      const mod = await import("plotly.js-dist-min");
      const Plotly = mod.default;
      if (!active || !elRef.current) return;
      plotlyLib = Plotly;
      if (title) elRef.current.dataset.title = title;
      const themed = buildThemedLayout(figure, resolvedTheme);
      try {
        Plotly.react(elRef.current, figure.data, themed, BASE_CONFIG);
      } catch (err) {
        console.error("[PlotlyChart] render error", err);
      }
    })();
    return () => {
      active = false;
      if (plotlyLib && elRef.current) {
        try {
          plotlyLib.purge(elRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, [figure, title, resolvedTheme]);

  return <div ref={elRef} className={cn("h-full w-full", className)} style={{ minHeight: 200 }} />;
}

export default PlotlyChart;
