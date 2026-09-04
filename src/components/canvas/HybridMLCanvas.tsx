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
  type Node,
  type OnConnect,
} from "@xyflow/react";
import { CaretLeft, CaretRight, SquaresFour } from "@phosphor-icons/react";
import { CustomCanvasNode } from "./CustomCanvasNode";
import { DatabaseSourceNode } from "./DatabaseSourceNode";
import { TextColumnsFixModal } from "./TextColumnsFixModal";
import { CanvasControls } from "./CanvasControls";
import { NodeLibrary } from "@/components/sidebar/NodeLibrary";
import { Header } from "@/components/navigation/Header";
import { Inspector } from "./Inspector";
import { ProblemsPanel } from "./ProblemsPanel";
import { ResultsDrawer } from "@/components/dashboard/ResultsDrawer";
import { CodeModal } from "@/components/dashboard/CodeModal";
import { GuideModal } from "@/components/dashboard/GuideModal";
import { AnalyticsModal } from "@/components/dashboard/AnalyticsModal";
import { WorkflowPanel } from "@/components/canvas/WorkflowPanel";
import { Toast, type ToastData } from "@/components/ui/toast";
import { getPaletteItem, hasModelNode, resolveRoute } from "@/lib/canvasConfig";
import { generateCode, generateNodeServer, type GeneratedCode } from "@/lib/codeGen";
import { autoConnectChain, summarizeDiagnostics, validatePipeline, type Diagnostic } from "@/lib/pipelineValidation";
import { pyodideSupported, probeServerEngine, serverHasNativePython, trainInBrowser } from "@/lib/localEngine";
import { deserializeWorkflow, downloadWorkflow, serializeWorkflow } from "@/lib/workflowSerialization";
import type { TerminalLine } from "@/components/dashboard/TerminalConsole";
import { hasSavedProject, loadProject, saveProject } from "@/lib/projectStorage";
import type {
  CsvDataset,
  ExecutionResponse,
  GraphEdgePayload,
  GraphNodePayload,
  GraphPayload,
  MLNodeData,
  NodeCategory,
  PaletteItem,
} from "@/lib/types";

const nodeTypes = { custom: CustomCanvasNode, dbSource: DatabaseSourceNode };

/** Canvas-wide node shape — one data payload, renderers keyed by `node.type`. */
type CanvasFlowNode = Node<MLNodeData>;

const DEFAULT_EDGE_OPTIONS = {
  // Animated edges keep a continuous SVG update loop alive even while idle.
  // Static edges are clearer for this editor and substantially cheaper to render.
  type: "smoothstep",
  style: { strokeWidth: 1.75 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-2)", width: 14, height: 14 },
};

/** Opens a fresh Colab notebook (within a user gesture to avoid popup blockers). */
const COLAB_CREATE_URL = "https://colab.research.google.com/#create=true";

/** Deep-learning node types the local PyTorch engine can train in-app.
 *  Everything else (HF Transformer, GAN, Autoencoder) stays on the Colab path. */
const LOCAL_DL_TYPES = ["dl:pytorch_mlp", "dl:cnn", "dl:lstm", "dl:gru", "dl:tabular_transformer"];

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

function createInitialGraph(): { nodes: CanvasFlowNode[]; edges: Edge[] } {
  const seed = (type: string, x: number, y: number): CanvasFlowNode => ({
    id: `${type}-seed`,
    type: "custom",
    position: { x, y },
    data: makeNodeData(type) as MLNodeData,
  });
  const nodes: CanvasFlowNode[] = [
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
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  /** null = probing, true = server Python imports PyTorch (in-app DL training). */
  const [serverTorch, setServerTorch] = useState<boolean | null>(null);
  const [response, setResponse] = useState<ExecutionResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [logs, setLogs] = useState<TerminalLine[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastId = useRef(0);
  const idCounter = useRef(100);
  const lineId = useRef(0);
  const lastLineAt = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedProjectAvailable, setSavedProjectAvailable] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [textFix, setTextFix] = useState<{ nodeId: string; columns: string[] } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedProjectAvailable(hasSavedProject());
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Probe once on mount so Train-click decisions (in-app DL vs Colab hand-off)
  // are made from cached state — never mid-click, which would break the
  // synchronous clipboard/window.open gesture the Colab path depends on.
  useEffect(() => {
    let cancelled = false;
    probeServerEngine()
      .then((info) => { if (!cancelled) setServerTorch(info.torch); })
      .catch(() => { if (!cancelled) setServerTorch(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-load the saved project when arriving via /canvas?load=1 (e.g. after
  // applying an AI Architect blueprint) so the user lands on the new nodes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("load") !== "1") return;
    try {
      const project = loadProject();
      if (!project) return;
      setNodes(project.nodes as CanvasFlowNode[]);
      setEdges(project.edges);
      setSavedProjectAvailable(true);
      notify("Loaded your AI Architect blueprint");
      window.setTimeout(() => fitView({ padding: 0.28, duration: 450 }), 0);
      // Clean the query param so a refresh doesn't reload over user edits.
      window.history.replaceState(null, "", "/canvas");
    } catch {
      /* fall through — the user can still load manually */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  
  // Check if there's CSV data available for analytics
  const csvDataset = useMemo(() => {
    const dataNode = nodes.find((n) => n.data.type === "data:csv" && n.data.dataset);
    return dataNode?.data.dataset ?? null;
  }, [nodes]);
  
  const hasDataForAnalytics = useMemo(() => csvDataset != null, [csvDataset]);

  // ── Live pipeline validation ────────────────────────────────────────────────
  const diagnostics = useMemo(
    () => validatePipeline(
      nodes.map<GraphNodePayload>((n) => ({
        id: n.id,
        type: n.data.type,
        category: n.data.category,
        label: n.data.label,
        params: n.data.params ? Object.fromEntries(n.data.params.map((p) => [p.key, p.value])) : undefined,
        dataset: n.data.dataset,
        imageDataset: n.data.imageDataset,
        position: n.position,
      })),
      edges.map<GraphEdgePayload>((e) => ({ id: e.id, source: e.source, target: e.target })),
    ),
    [nodes, edges],
  );
  const problemCounts = useMemo(() => summarizeDiagnostics(diagnostics), [diagnostics]);
  const blockingErrors = problemCounts.errors;

  const focusNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
  }, [setNodes]);

  /** Execute a validation auto-fix against the canvas state. */
  const handleApplyFix = useCallback((diagnostic: Diagnostic) => {
    const fix = diagnostic.fix;
    if (!fix) return;
    switch (fix.kind) {
      case "remove-edge": {
        setEdges((eds) => eds.filter((e) => e.id !== fix.edgeId));
        notify("Removed the circular link");
        break;
      }
      case "remove-node": {
        setNodes((nds) => nds.filter((n) => n.id !== fix.nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== fix.nodeId && e.target !== fix.nodeId));
        notify("Removed the extra node");
        break;
      }
      case "set-param": {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === fix.nodeId && n.data.params
              ? { ...n, data: { ...n.data, params: n.data.params.map((p) => (p.key === fix.key ? { ...p, value: fix.value } : p)) } }
              : n,
          ),
        );
        notify(`Set ${fix.key} = ${fix.value}`);
        break;
      }
      case "add-imputer": {
        const target = nodes.find((n) => n.id === fix.nodeId);
        if (!target) return;
        const incomingEdge = edges.find((e) => e.target === fix.nodeId);
        if (!incomingEdge) return;
        const palette = getPaletteItem("pre:impute");
        if (!palette) return;
        const newId = `pre:impute-autofix-${Date.now()}`;
        const imputerNode: CanvasFlowNode = {
          id: newId,
          type: "custom",
          position: { x: target.position.x - 240, y: target.position.y },
          data: {
            type: palette.type, label: palette.label, description: palette.description,
            category: palette.category, icon: palette.icon, accent: palette.accent,
            params: palette.params?.map((p) => ({ ...p })),
          },
        };
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...imputerNode, selected: true }]);
        setEdges((eds) =>
          eds
            .filter((e) => e.id !== incomingEdge.id)
            .concat([
              { id: `autofix-${incomingEdge.id}-a`, source: incomingEdge.source, target: newId, ...DEFAULT_EDGE_OPTIONS },
              { id: `autofix-${incomingEdge.id}-b`, source: newId, target: fix.nodeId, ...DEFAULT_EDGE_OPTIONS },
            ]),
        );
        notify("Inserted median imputation before this step");
        break;
      }
      case "resolve-text-columns": {
        // The diagnostic is attached to the downstream node, but the dataset
        // lives on the data source feeding it.
        const source = nodes.find((n) => n.id === fix.sourceId);
        if (!source?.data.dataset) {
          notify("Fetch data into the source node first, then fix the columns", "warn");
          return;
        }
        // Ask permission — the modal lets the user pick drop/encode per column.
        setTextFix({ nodeId: fix.sourceId, columns: fix.columns });
        return;
      }
      case "auto-connect": {
        const additions = autoConnectChain({
          nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, category: n.data.category, x: n.position.x })),
          edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        });
        if (additions.length > 0) {
          // Dedupe inside the updater — "Fix all" fires this several times
          // against a stale closure, and without this the same link is added twice.
          let applied = 0;
          setEdges((eds) => {
            const seen = new Set(eds.map((e) => `${e.source}->${e.target}`));
            const fresh = additions.filter((a) => !seen.has(`${a.source}->${a.target}`));
            if (fresh.length === 0) return eds;
            applied = fresh.length;
            return eds.concat(fresh.map((a) => ({ id: `${a.id}-${Date.now()}`, source: a.source, target: a.target, ...DEFAULT_EDGE_OPTIONS })));
          });
          notify(applied > 0 ? `Connected ${applied} missing link${applied === 1 ? "" : "s"}` : "Nothing left to connect");
        } else {
          notify("Nothing left to connect");
        }
        break;
      }
    }
  }, [edges, nodes, notify, setEdges, setNodes]);

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
      const flowType = item.type === "data:db" ? "dbSource" : "custom";
      setNodes((nds) =>
        nds.concat({ id: `${item.type}-${idCounter.current}`, type: flowType, position, data }),
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
        notify("Colab opened and training code copied. Paste it into the first cell");
      } else {
        notify("Colab opened. Click Copy code to grab the script", "warn");
      }
      return gen;
    },
    [notify],
  );

  const pushLine = useCallback((text: string, level: TerminalLine["level"] = "info") => {
    lineId.current += 1;
    const now = new Date();
    const durationMs = lastLineAt.current !== null ? now.getTime() - lastLineAt.current : undefined;
    lastLineAt.current = now.getTime();
    setLogs((l) => [...l, { id: lineId.current, text, time: now, durationMs, level }]);
  }, []);

  /** Stamp every canvas node with a lifecycle status shown on the card. */
  const stampStatuses = useCallback((status: "running" | "success" | "error" | undefined) => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, executionStatus: status } })));
  }, [setNodes]);

  const handleExecute = useCallback(async () => {
    if (!hasModel) return;

    // Hard-stop on structural problems — the engine would reject them anyway.
    if (blockingErrors > 0) {
      notify(`Fix ${blockingErrors} pipeline problem${blockingErrors === 1 ? "" : "s"} before training`, "warn");
      return;
    }

    const payload = buildPayload();
    setLoading(true);
    setResponse(null);
    setLogs([]);
    setLiveMetrics({});
    setDrawerOpen(true);
    lastLineAt.current = null;
    stampStatuses("running");
    pushLine(`Dispatching ${payload.nodes.length}-step ${route === "colab" ? "Colab GPU" : "instant CPU"} pipeline…`, "system");

    // Deep-learning route: when the server has PyTorch AND every DL node is one
    // the local engine can train (MLP / CNN / LSTM / GRU / tabular transformer),
    // the neural network trains in-app and the NDJSON stream carries live epoch
    // events — no Colab hand-off. Otherwise fall back to the notebook path:
    // open Colab + copy the code SYNCHRONOUSLY (before any await, so the click
    // gesture survives and clipboard/window.open both work).
    const dlTypes = nodes.map((n) => n.data.type).filter((t) => t.startsWith("dl:"));
    const locallyTrainable =
      serverTorch === true &&
      dlTypes.length > 0 &&
      dlTypes.every((t) => LOCAL_DL_TYPES.includes(t));
    if (route === "colab" && !locallyTrainable) {
      const gen = handOffToColab(payload);
      setGeneratedCode(gen); // seed the code viewer with the same script
      pushLine(
        serverTorch === false
          ? "Training code copied, paste it into the opened Colab notebook."
          : "This model needs the Colab GPU runtime (HF/BERT, GAN or autoencoder) — training code copied to the opened notebook.",
        "system",
      );
    } else if (route === "colab") {
      pushLine("Server has PyTorch — training the deep-learning graph in-app on the local runtime…", "system");
    }

    try {
      // ── Compute-tier selection ────────────────────────────────────────────
      // 1) Server-side Python (best), 2) user's browser via Pyodide/WASM,
      // 3) server's built-in TypeScript fallback (last resort).
      const native = await serverHasNativePython();
      if (!native && route === "instant" && pyodideSupported()) {
        pushLine("No Python stack on the deployment, training locally in your browser (nothing is uploaded)…", "system");
        try {
          const local = await trainInBrowser(payload, (message) => pushLine(message));
          setResponse(local);
          const ok = local.status === "success";
          pushLine(
            ok ? `Trained on this device in ${(local.timing.total_seconds ?? 0).toFixed(2)}s.` : `Engine error: ${local.error ?? "unknown failure"}`,
            ok ? "success" : "error",
          );
          stampStatuses(ok ? "success" : "error");
          return;
        } catch (localError) {
          pushLine(`Local engine unavailable (${localError instanceof Error ? localError.message : "failed"}), trying the server engine…`, "system");
        }
      }

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
          if (evt.type === "step" && evt.message) pushLine(evt.message);
          else if (evt.type === "metric" && evt.name) setLiveMetrics((m) => ({ ...m, [evt.name!]: evt.value ?? 0 }));
          else if (evt.type === "result" && evt.data) {
            setResponse(evt.data);
            const ok = evt.data.status === "success";
            const seconds = "timing" in evt.data ? evt.data.timing.total_seconds ?? 0 : 0;
            pushLine(ok ? `Run complete in ${seconds.toFixed(2)}s.` : `Engine error: ${evt.data.error ?? "unknown failure"}`, ok ? "success" : "error");
            stampStatuses(ok ? "success" : "error");
          }
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
      pushLine(err instanceof Error ? err.message : "Network request failed", "error");
      stampStatuses("error");
    } finally {
      setLoading(false);
    }
  }, [blockingErrors, buildPayload, hasModel, notify, pushLine, route, handOffToColab, stampStatuses]);

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
      setNodes(project.nodes as CanvasFlowNode[]);
      setEdges(project.edges);
      setSavedProjectAvailable(true);
      notify("Loaded your local Datlify project");
      window.setTimeout(() => fitView({ padding: 0.28, duration: 450 }), 0);
    } catch {
      notify("Could not load the local project", "warn");
    }
  }, [fitView, notify, setEdges, setNodes]);

  const handleFit = useCallback(() => fitView({ padding: 0.28, duration: 450 }), [fitView]);

  const handleExport = useCallback(() => {
    try {
      downloadWorkflow(serializeWorkflow(nodes, edges));
      notify("Workflow exported with positions, parameters, and datasets");
    } catch {
      notify("Could not serialize this workflow", "warn");
    }
  }, [edges, nodes, notify]);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const result = deserializeWorkflow(text);
      if (!result.ok) {
        notify(result.error, "warn");
        return;
      }
      setNodes(result.nodes);
      setEdges(result.edges);
      stampStatuses(undefined);
      setResponse(null);
      notify(`Imported “${result.title}”, ${result.nodes.length} steps restored`);
      window.setTimeout(() => fitView({ padding: 0.28, duration: 450 }), 0);
    } catch {
      notify("Could not read that workflow file", "warn");
    }
  }, [fitView, notify, setEdges, setNodes, stampStatuses]);

  const closeInspector = useCallback(() => setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))), [setNodes]);

  const textFixNode = useMemo(
    () => (textFix ? nodes.find((n) => n.id === textFix.nodeId) ?? null : null),
    [nodes, textFix],
  );

  /** Rewrite the source node's dataset once the user confirms the column fix. */
  const applyTextColumnFix = useCallback((dataset: CsvDataset, summary: string) => {
    if (!textFix) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === textFix.nodeId
          ? { ...n, data: { ...n.data, dataset, description: `${dataset.nrows.toLocaleString()} rows, ${dataset.columns.length} cols, fixed (${summary})` } }
          : n,
      ),
    );
    notify(`Dataset rewritten — ${summary}`);
    setTextFix(null);
  }, [notify, setNodes, textFix]);

  return (
    <div className="nf-canvas-bg flex h-screen w-full flex-col">
      <Header
        route={route}
        localDl={serverTorch === true}
        hasModel={hasModel}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        loading={loading}
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        onGuide={() => setGuideOpen(true)}
        onCode={openCode}
        onBuildAI={() => {
          // Save is best-effort only — large datasets can overflow local
          // storage, and that must never block opening the AI architect.
          try {
            const project = saveProject(nodes, edges);
            setSavedProjectAvailable(true);
            void project;
          } catch {
            notify("Pipeline too large for browser storage, the architect will attach what it can", "warn");
          }
          router.push("/build");
        }}
        onSave={handleSave}
        onLoad={handleLoad}
        hasSavedProject={storageReady && savedProjectAvailable}
        onExport={handleExport}
        onImportWorkflow={() => fileInputRef.current?.click()}
        onClear={handleClear}
        onFit={fitView}
        onExecute={handleExecute}
        onAnalytics={() => setAnalyticsOpen(true)}
        hasDataForAnalytics={hasDataForAnalytics}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
          event.target.value = "";
        }}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Cinematic backdrop — HUD grid + aurora, matching the landing hero */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="nf-canvas-aurora absolute inset-0" aria-hidden />
          <div className="nf-canvas-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--background)] to-transparent" aria-hidden />
        </div>

        {paletteOpen ? <NodeLibrary /> : null}
        <main className="relative flex-1">
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
            connectionRadius={32}
            snapGrid={[16, 16]}
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-transparent"
          >
            <CanvasControls />
          </ReactFlow>

          <div className="pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-white/95 px-4 py-2.5 shadow-lg shadow-black/[0.05] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0a0a0d]/80 dark:shadow-black/40">
            <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${blockingErrors > 0 ? "text-rose-500" : hasModel ? "text-emerald-500" : "text-amber-500"}`}>
              {blockingErrors > 0 ? `${blockingErrors} error${blockingErrors === 1 ? "" : "s"}` : hasModel ? "Ready" : "Incomplete"}
            </span>
            <span className="h-3 w-px bg-neutral-200 dark:bg-white/10" aria-hidden />
            <span className="font-mono text-[10px] tracking-wide text-neutral-400 dark:text-zinc-500">{nodes.length} steps</span>
            <span className="h-3 w-px bg-neutral-200 dark:bg-white/10" aria-hidden />
            <span className="font-mono text-[10px] tracking-wide text-neutral-400 dark:text-zinc-500">{edges.length} links</span>
            {problemCounts.warnings > 0 ? (
              <>
                <span className="h-3 w-px bg-neutral-200 dark:bg-white/10" aria-hidden />
                <span className="font-mono text-[10px] tracking-wide text-amber-500">{problemCounts.warnings} warning{problemCounts.warnings === 1 ? "" : "s"}</span>
              </>
            ) : null}
          </div>

          <ProblemsPanel diagnostics={diagnostics} onSelectNode={focusNode} onApplyFix={handleApplyFix} />

          {textFix && textFixNode?.data.dataset ? (
            <TextColumnsFixModal
              open
              onClose={() => setTextFix(null)}
              dataset={textFixNode.data.dataset}
              columns={textFix.columns}
              onApply={applyTextColumnFix}
            />
          ) : null}

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-400/60 bg-white/[0.04] dark:border-white/25">
              <div className="animate-slide-up rounded-2xl border border-neutral-200/80 bg-white/95 px-7 py-5 text-center shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0a0a0d]/90">
                <p className="nf-hud-label">drop zone</p>
                <p className="mt-1.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Drop to add this step</p>
                <p className="mt-1 text-xs text-neutral-400 dark:text-zinc-500">Connect it to the nearest node when ready</p>
              </div>
            </div>
          ) : null}

          {nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-slide-up text-center">
                <div className="nf-hud-corners relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.03]">
                  <SquaresFour size={26} weight="light" className="text-neutral-400 dark:text-zinc-500" />
                </div>
                <p className="mt-5 text-base font-semibold tracking-tight text-neutral-900 dark:text-white">Start with a dataset</p>
                <p className="mt-1.5 text-xs text-neutral-400 dark:text-zinc-500">Drag a node from the library to begin your pipeline.</p>
                <p className="nf-hud-label mt-6">canvas://untitled, awaiting first node</p>
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
          
          <AnalyticsModal
            open={analyticsOpen}
            onClose={() => setAnalyticsOpen(false)}
            csvDataset={csvDataset}
          />
        </main>

        {selectedNode ? (
          <Inspector node={selectedNode} onClose={closeInspector} />
        ) : workflowOpen ? (
          <WorkflowPanel nodeCount={nodes.length} edgeCount={edges.length} route={route} hasModel={hasModel} errors={blockingErrors} warnings={problemCounts.warnings} onExecute={handleExecute} onCode={openCode} onCollapse={() => setWorkflowOpen(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setWorkflowOpen(true)}
            aria-label="Show workflow panel"
            title="Show workflow panel"
            className="hidden h-full w-11 shrink-0 flex-col items-center gap-3 border-l border-neutral-200/80 bg-white/95 glass-panel py-4 text-neutral-400 transition-colors hover:text-neutral-900 lg:flex dark:border-white/[0.06] dark:bg-[#050506]/60 dark:text-zinc-500 dark:hover:text-white"
          >
            <CaretLeft size={15} />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] [writing-mode:vertical-rl]">Workflow</span>
          </button>
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


