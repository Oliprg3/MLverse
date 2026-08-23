import type { Edge, Node } from "@xyflow/react";
import type { MLNodeData } from "@/lib/types";

const STORAGE_KEY = "neuralforge:project:v1";

export interface SavedProject {
  version: 1;
  savedAt: string;
  title: string;
  nodes: Node<MLNodeData>[];
  edges: Edge[];
}

/** Drop multi-megabyte payload fields while keeping pipeline structure. */
function slimNodes(nodes: Node<MLNodeData>[]): Node<MLNodeData>[] {
  return nodes.map((node) => {
    const data = node.data;
    const next: MLNodeData = { ...data };
    if (next.dataset) {
      const { csvText, ...rest } = next.dataset;
      void csvText;
      next.dataset = rest as typeof next.dataset;
    }
    if (next.imageDataset) {
      next.imageDataset = {
        ...next.imageDataset,
        vectors: [],
        thumbnails: [],
      };
    }
    return { ...node, data: next };
  });
}

export function saveProject(nodes: Node<MLNodeData>[], edges: Edge[], title = "NeuralForge Pipeline"): SavedProject {
  const project: SavedProject = { version: 1, savedAt: new Date().toISOString(), title, nodes, edges };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return project;
  } catch {
    // Quota exceeded (large CSV / image payloads) — retry with payloads stripped
    // so the model structure still reaches the AI builder.
    const slim: SavedProject = { ...project, nodes: slimNodes(nodes) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    return slim;
  }
}

export function loadProject(): SavedProject | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedProject>;
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      title: typeof parsed.title === "string" ? parsed.title : "NeuralForge Pipeline",
      nodes: parsed.nodes as Node<MLNodeData>[],
      edges: parsed.edges as Edge[],
    };
  } catch {
    return null;
  }
}

export function hasSavedProject(): boolean {
  return Boolean(window.localStorage.getItem(STORAGE_KEY));
}
