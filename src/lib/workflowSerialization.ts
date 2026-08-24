/**
 * workflowSerialization.ts — lossless save / load / export / import of the
 * full canvas graph AST.
 *
 * The serialized form keeps node identity, positions, every hyperparameter
 * (including chart selections), and the attached dataset payloads, so a
 * workflow file restores a runnable pipeline byte-for-byte.
 */

import { getPaletteItem } from "./canvasConfig";
import type { CustomFlowNode } from "@/components/canvas/CustomCanvasNode";
import type { CsvDataset, ImageDataset, ImageDataset as ImageDatasetAlias, MLNodeData } from "./types";
import type { Edge as FlowEdge } from "@xyflow/react";

export const WORKFLOW_FORMAT = 2;

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  params?: Array<{ key: string; value: string | number }>;
  dataset?: CsvDataset;
  imageDataset?: ImageDataset;
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowFile {
  format: "neuralforge-workflow";
  version: number;
  savedAt: string;
  title: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export function serializeWorkflow(
  nodes: CustomFlowNode[],
  edges: FlowEdge[],
  title = "Datlify Pipeline",
): WorkflowFile {
  return {
    format: "neuralforge-workflow",
    version: WORKFLOW_FORMAT,
    savedAt: new Date().toISOString(),
    title,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      params: node.data.params?.map((p) => ({ key: p.key, value: p.value })),
      dataset: node.data.dataset,
      imageDataset: node.data.imageDataset,
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

export type DeserializeResult =
  | { ok: true; nodes: CustomFlowNode[]; edges: FlowEdge[]; title: string }
  | { ok: false; error: string };

/** Rebuild canvas nodes from a workflow file, merging saved values onto fresh palette defaults. */
export function deserializeWorkflow(raw: string | Partial<WorkflowFile>): DeserializeResult {
  let parsed: Partial<WorkflowFile>;
  try {
    parsed = typeof raw === "string" ? (JSON.parse(raw) as Partial<WorkflowFile>) : raw;
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }

  if (parsed.format !== "neuralforge-workflow" || !Array.isArray(parsed.nodes)) {
    // Tolerate legacy export shape (raw GraphPayload).
    const legacy = parsed as unknown as { nodes?: Array<{ id: string; type?: string; category?: string; label?: string; params?: Record<string, string | number>; dataset?: CsvDataset; imageDataset?: ImageDatasetAlias; position?: { x: number; y: number } }>; edges?: Array<{ id?: string; source: string; target: string }> };
    if (Array.isArray(legacy.nodes) && legacy.nodes.every((n) => typeof n.type === "string")) {
      return buildGraph(legacy.nodes.map((n) => ({
        id: n.id,
        type: n.type!,
        position: n.position ?? { x: 0, y: 0 },
        params: Object.entries(n.params ?? {}).map(([key, value]) => ({ key, value })),
        dataset: n.dataset,
        imageDataset: n.imageDataset,
      })), (legacy.edges ?? []).map((e, i) => ({ id: e.id ?? `e${i}`, source: e.source, target: e.target })), "Imported pipeline");
    }
    return { ok: false, error: "This file is not a Datlify workflow." };
  }

  if ((parsed.version ?? 0) > WORKFLOW_FORMAT) {
    return { ok: false, error: `This workflow was created by a newer version (v${parsed.version}). Update the app.` };
  }

  return buildGraph(
    parsed.nodes as SerializedNode[],
    parsed.edges ?? [],
    typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Restored workflow",
  );
}

function buildGraph(serializedNodes: SerializedNode[], serializedEdges: SerializedEdge[], title: string): DeserializeResult {
  const nodes: CustomFlowNode[] = [];
  const missing: string[] = [];

  for (const sn of serializedNodes) {
    const palette = getPaletteItem(sn.type);
    if (!palette) {
      missing.push(sn.type);
      continue;
    }
    const data: MLNodeData = {
      type: palette.type,
      label: palette.label,
      description: palette.description,
      category: palette.category,
      icon: palette.icon,
      accent: palette.accent,
      params: palette.params ? palette.params.map((p) => ({ ...p })) : undefined,
      dataset: sn.dataset,
      imageDataset: sn.imageDataset,
    };
    // Merge saved parameter values onto current defaults by key.
    if (data.params && Array.isArray(sn.params)) {
      for (const saved of sn.params) {
        const target = data.params.find((p) => p.key === saved.key);
        if (target) target.value = saved.value;
      }
    }
    nodes.push({
      id: sn.id || `${sn.type}-${nodes.length}`,
      type: "custom",
      position: sn.position ?? { x: 0, y: 0 },
      data,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: FlowEdge[] = serializedEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, i) => ({ id: e.id || `restored-${i}`, source: e.source, target: e.target }));

  if (nodes.length === 0) {
    return { ok: false, error: missing.length > 0 ? `Unknown node types: ${[...new Set(missing)].join(", ")}` : "The workflow contains no nodes." };
  }

  return { ok: true, nodes, edges, title };
}

export function downloadWorkflow(file: WorkflowFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `datlify-workflow-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
