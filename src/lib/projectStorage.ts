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

export function saveProject(nodes: Node<MLNodeData>[], edges: Edge[], title = "NeuralForge Pipeline"): SavedProject {
  const project: SavedProject = { version: 1, savedAt: new Date().toISOString(), title, nodes, edges };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  return project;
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
