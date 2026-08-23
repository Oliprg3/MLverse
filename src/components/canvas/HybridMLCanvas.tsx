"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  MarkerType,
  type Connection,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import { SquaresFour } from "@phosphor-icons/react";
import { CustomCanvasNode, type CustomFlowNode } from "./CustomCanvasNode";
import { CanvasControls } from "./CanvasControls";
import { NodeLibrary } from "@/components/sidebar/NodeLibrary";
import { Header } from "@/components/navigation/Header";
import { Inspector } from "./Inspector";
import { ResultsDrawer } from "@/components/dashboard/ResultsDrawer";
import { CodeModal } from "@/components/dashboard/CodeModal";
import { GuideModal } from "@/components/dashboard/GuideModal";
import { WorkflowPanel } from "@/components/canvas/WorkflowPanel";
import { Toast, type ToastData } from "@/components/ui/toast";
import { getPaletteItem, hasModelNode, resolveRoute } from "@/lib/canvasConfig";
import { generateCode, type GeneratedCode } from "@/lib/codeGen";
import { hasSavedProject, loadProject, saveProject } from "@/lib/projectStorage";
import type {
  ExecutionResponse,
  GraphEdgePayload,
  GraphNodePayload,
  GraphPayload,
  MLNodeData,
  NodeCategory,
  PaletteItem,
} from "@/lib/types";

const nodeTypes = { custom: CustomCanvasNode };

const DEFAULT_EDGE_OPTIONS = {
  // Animated edges keep a continuous SVG update loop alive even while idle.
  // Static edges are clearer for this editor and substantially cheaper to render.
  type: "smoothstep",
  style: { strokeWidth: 1.75 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-2)", width: 14, height: 14 },
};

/** Opens a fresh Colab notebook (within a user gesture to avoid popup blockers). */
const COLAB_CREATE_URL = "https://colab.research.google.com/#create=true";

/**
 * Copy text to the clipboard SYNCHRONOUSLY (within a user gesture).
 * Returns whether a copy mechanism was available. Clipboard writes invoked
 * synchronously in a click work reliably; ones deferred past an `await` do not.
 */
function copyToClipboardSync(text: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      // Fire within the gesture; the async write resolves shortly after.
      void navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}



function makeNodeData(type: string): MLNodeData | null {
  const item = getPaletteItem(type);
  if (!item) return null;
  return {
    type: item.type,
    label: item.label,
    description: item.description,
    category: item.category,
    icon: item.icon,
    accent: item.accent,
    params: item.params ? item.params.map((p) => ({ ...p })) : undefined,
  };
}

function createInitialGraph(): { nodes: CustomFlowNode[]; edges: Edge[] } {
  const seed = (type: string, x: number, y: number): CustomFlowNode => ({
    id: `${type}-seed`,
    type: "custom",
    position: { x, y },
    data: makeNodeData(type) as MLNodeData,
  });
  const nodes: CustomFlowNode[] = [
    seed("data:breast_cancer", -360, -20),
    seed("pre:scaler", -90, -20),
    seed("ml:random_forest", 180, -20),
    seed("viz:charts", 450, -20),
  ];
  const edges: Edge[] = [
    { id: "e1", source: "data:breast_cancer-seed", target: "pre:scaler-seed", ...DEFAULT_EDGE_OPTIONS },
    { id: "e2", source: "pre:scaler-seed", target: "ml:random_forest-seed", ...DEFAULT_EDGE_OPTIONS },
    { id: "e3", source: "ml:random_forest-seed", target: "viz:charts-seed", ...DEFAULT_EDGE_OPTIONS },
  ];
  return { nodes, edges };
}

function Canvas() {
  const initial = useMemo(createInitialGraph, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [response, setResponse] = useState<ExecutionResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastId = useRef(0);
  const idCounter = useRef(100);
  const [savedProjectAvailable, setSavedProjectAvailable] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedProjectAvailable(hasSavedProject());
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback((message: string, tone: ToastData["tone"] = "success") => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, tone });
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, ...DEFAULT_EDGE_OPTIONS }, eds)),
    [setEdges],
  );

  const categories: NodeCategory[] = useMemo(() => nodes.map((n) => n.data.category), [nodes]);
  const route = useMemo(() => resolveRoute(categories), [categories]);
  const hasModel = useMemo(() => hasModelNode(categories), [categories]);
  const selectedNode = useMemo(() => nodes.find((n) => n.selected) ?? null, [nodes]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragActive(false), []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragActive(false);
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      let item: PaletteItem;
      try {
        item = JSON.parse(raw) as PaletteItem;
      } catch {
        return;
      }
      const data = makeNodeData(item.type);
      if (!data) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      idCounter.current += 1;
      setNodes((nds) =>
        nds.concat({ id: `${item.type}-${idCounter.current}`, type: "custom", position, data }),
      );
    },
    [screenToFlowPosition, setNodes],
  );

  const buildPayload = useCallback(
    (): GraphPayload => ({
      nodes: nodes.map<GraphNodePayload>((n) => ({
        id: n.id,
        type: n.data.type,
        category: n.data.category,
        label: n.data.label,
        params: n.data.params ? Object.fromEntries(n.data.params.map((p) => [p.key, p.value])) : undefined,
        dataset: n.data.dataset,
        imageDataset: n.data.imageDataset,
        position: n.position,
      })),
      edges: edges.map<GraphEdgePayload>((e) => ({ id: e.id, source: e.source, target: e.target })),
      meta: { title: "AI Canvas Pipeline", created_at: new Date().toISOString() },
    }),
    [nodes, edges],
  );

  /**
   * Hand-off to Colab: generate the node-based code, copy it to the clipboard,
   * and open a fresh Colab notebook — all SYNCHRONOUSLY within the user's click
   * gesture. This is the key fix: clipboard writes (and window.open) only work
   * reliably before any `await`, otherwise the browser drops the gesture and
   * the code never lands on the clipboard.
   */
  const handOffToColab = useCallback(
    (payload: GraphPayload, editedCode?: string) => {
      const gen = generateCode(payload); // client-side, instant, reflects the nodes
      const codeToCopy = editedCode ?? gen.code;
      const ok = copyToClipboardSync(codeToCopy);
      const win = window.open(COLAB_CREATE_URL, "_blank", "noopener");
      if (!win) {
        notify("Allow pop-ups for this site to open Colab", "warn");
      } else if (ok) {
        notify("Colab opened · training code copied — paste (⌘V / Ctrl+V) into the first cell");
      } else {
        notify("Colab opened · click “Copy code” to grab the script", "warn");
      }
      return gen;
    },
    [notify],
  );

  const handleExecute = useCallback(async () => {
    if (!hasModel) return;
    const payload = buildPayload();
    setLoading(true);
    setResponse(null);
    setLogs([]);
    setLiveMetrics({});
    setDrawerOpen(true);

    // Deep-learning route: open Colab + copy the code SYNCHRONOUSLY (before await).
    if (route === "colab") {
      const gen = handOffToColab(payload);
      setGeneratedCode(gen); // seed the code viewer with the same script
    }

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Consume the NDJSON stream so the user sees training happen live.
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let evt: { type?: string; message?: string; name?: string; value?: number; data?: ExecutionResponse };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "step" && evt.message) setLogs((l) => [...l, evt.message!]);
          else if (evt.type === "metric" && evt.name) setLiveMetrics((m) => ({ ...m, [evt.name!]: evt.value ?? 0 }));
          else if (evt.type === "result" && evt.data) setResponse(evt.data);
        }
      }
    } catch (err) {
      setResponse({
        route: "instant",
        status: "error",
        engine: "node-proxy",
        pipeline: { steps: [] },
        dataset: { name: "", n_samples: 0, n_features: 0, n_classes: 0, target_type: "" },
        model: { name: "", framework: "" },
        metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, roc_auc: 0, average_precision: 0 },
        charts: {},
        charts_requested: [],
        predictions: { y_true: [], y_pred: [], classes: [], n_test: 0 },
        timing: { total_seconds: 0, training_seconds: 0 },
        error: err instanceof Error ? err.message : "Network request failed",
      });
    } finally {
      setLoading(false);
    }
  }, [buildPayload, hasModel, route, handOffToColab]);

  /** Re-copy + re-open from the drawer button (fresh click gesture). */
  const handleOpenColab = useCallback((editedCode?: string) => {
    const gen = handOffToColab(buildPayload(), editedCode);
    if (editedCode) setGeneratedCode({ ...gen, code: editedCode });
  }, [buildPayload, handOffToColab]);

  const openCode = useCallback(() => {
    setGeneratedCode((current) => current ?? generateCode(buildPayload()));
    setCodeOpen(true);
  }, [buildPayload]);

  const regenerateCode = useCallback(() => {
    setGeneratedCode(generateCode(buildPayload()));
  }, [buildPayload]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const handleSave = useCallback(() => {
    try {
      const project = saveProject(nodes, edges);
      setSavedProjectAvailable(true);
      notify(`Saved locally at ${new Date(project.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch {
      notify("Could not save this project in browser storage", "warn");
    }
  }, [edges, nodes, notify]);

  const handleLoad = useCallback(() => {
    try {
      const project = loadProject();
      if (!project) {
        notify("No local project has been saved yet", "warn");
        return;
      }
      setNodes(project.nodes as CustomFlowNode[]);
      setEdges(project.edges);
      setSavedProjectAvailable(true);
      notify("Loaded your local NeuralForge project");
      window.setTimeout(() => fitView({ padding: 0.28, duration: 450 }), 0);
    } catch {
      notify("Could not load the local project", "warn");
    }
  }, [fitView, notify, setEdges, setNodes]);

  const handleFit = useCallback(() => fitView({ padding: 0.28, duration: 450 }), [fitView]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neuralforge-pipeline.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [buildPayload]);

  const closeInspector = useCallback(() => setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))), [setNodes]);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <Header
        route={route}
        hasModel={hasModel}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        loading={loading}
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        onGuide={() => setGuideOpen(true)}
        onCode={openCode}
        onBuildAI={() => {
          try {
            saveProject(nodes, edges);
            setSavedProjectAvailable(true);
            router.push("/build");
          } catch {
            notify("Could not prepare the pipeline for the AI builder", "warn");
          }
        }}
        onSave={handleSave}
        onLoad={handleLoad}
        hasSavedProject={storageReady && savedProjectAvailable}
        onExport={handleExport}
        onClear={handleClear}
        onFit={handleFit}
        onExecute={handleExecute}
      />

      <div className="flex flex-1 overflow-hidden">
        {paletteOpen ? <NodeLibrary /> : null}
        <main className="relative flex-1 bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-transparent"
          >
            <CanvasControls />
          </ReactFlow>

          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border border-border bg-surface/95 px-3 py-2 shadow-sm backdrop-blur-md">
            <span className={hasModel ? "h-1.5 w-1.5 rounded-full bg-emerald-400" : "h-1.5 w-1.5 rounded-full bg-amber-400"} />
            <span className="text-[11px] font-medium text-foreground-2">{hasModel ? "Ready" : "Incomplete"}</span>
            <span className="text-[10px] text-muted">{nodes.length} steps · {edges.length} connections</span>
          </div>

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/[0.06]">
              <div className="animate-slide-up rounded-lg border border-border bg-surface px-5 py-3 text-center shadow-lg">
                <p className="text-sm font-semibold text-foreground">Drop to add this step</p>
                <p className="mt-1 text-xs text-muted">Connect it to the nearest node when ready</p>
              </div>
            </div>
          ) : null}

          {nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-slide-up text-center">
                <SquaresFour size={30} weight="light" className="mx-auto text-muted-2" />
                <p className="mt-3 text-sm font-semibold tracking-tight text-foreground-2">Start with a dataset</p>
                <p className="mt-1 text-xs text-muted">Drag a node from the library to begin your pipeline.</p>
              </div>
            </div>
          ) : null}

          <ResultsDrawer
            open={drawerOpen}
            loading={loading}
            logs={logs}
            liveMetrics={liveMetrics}
            response={response}
            onClose={() => setDrawerOpen(false)}
            onViewCode={openCode}
            onOpenColab={handleOpenColab}
            code={generatedCode?.code}
          />
        </main>

        {selectedNode ? (
          <Inspector node={selectedNode} onClose={closeInspector} />
        ) : (
          <WorkflowPanel nodeCount={nodes.length} edgeCount={edges.length} route={route} hasModel={hasModel} onExecute={handleExecute} onCode={openCode} />
        )}
      </div>

      <CodeModal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        code={generatedCode}
        graph={buildPayload()}
        onChange={setGeneratedCode}
        onRegenerate={regenerateCode}
        onOpenColab={handleOpenColab}
        onNotify={notify}
      />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}

export function HybridMLCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

export default HybridMLCanvas;

