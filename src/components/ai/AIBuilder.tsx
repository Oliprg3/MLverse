"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  ArrowLeft,
  CaretDown,
  ChatCenteredDots,
  Check,
  CircleNotch,
  PaperPlaneRight,
  Sparkle,
} from "@phosphor-icons/react";
import Image from "next/image";
import { loadProject, saveProject, type SavedProject } from "@/lib/projectStorage";
import { getPaletteItem, CATEGORIES } from "@/lib/canvasConfig";
import { resolveIcon } from "@/lib/icons";
import type { MLNodeData, NodeCategory } from "@/lib/types";

/* ── Types ───────────────────────────────────────────────────────────────── */

type BlueprintNode = { type: string; reason: string };
type AlgorithmSuggestion = { algorithm: string; type: string; score: number; reason: string };
type Blueprint = { nodes: BlueprintNode[]; suggestions: AlgorithmSuggestion[] };

type BuilderMessage = {
  role: "user" | "assistant";
  content: string;
  blueprint?: Blueprint;
  provider?: string;
  model?: string;
};

const SESSION_KEY = "neuralforge:aibuilder:v3";

/** Stream event shapes emitted by /api/ai/chat. */
type TraceStep = { label: string; detail?: string };
type ChatStreamEvent =
  | { type: "trace"; steps: TraceStep[] }
  | { type: "delta"; text: string }
  | { type: "blueprint"; blueprint: Blueprint; suggestions: AlgorithmSuggestion[] }
  | { type: "casual"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; provider: string; model: string };

const SUGGESTION_CHIPS = [
  "Predict customer churn",
  "Forecast weekly demand",
  "Classify support tickets",
  "Detect defects in product photos",
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function toGraphSummary(project: SavedProject | null) {
  if (!project) return { nodes: [] as Array<{ type: string; label: string; category: string }>, edges: [] as Array<{ source: string; target: string }> };
  return {
    nodes: project.nodes.map((node) => {
      const data = node.data as MLNodeData;
      return { type: data.type, label: data.label, category: data.category };
    }),
    edges: project.edges.map((edge) => ({ source: edge.source, target: edge.target })),
  };
}

/** Column-aware layout so the proposed pipeline reads left-to-right by stage
 *  instead of a diagonal staircase. */
const STAGE_COLUMN: Record<string, number> = {
  data: 0,
  pre: 1,
  feature: 1,
  dl: 2,
  classic_ml: 2,
  eval: 3,
  viz: 3,
};

function stageOf(type: string): number {
  const item = getPaletteItem(type);
  if (!item) return 1;
  const direct = STAGE_COLUMN[item.category];
  if (direct !== undefined) return direct;
  return type.split(":")[0] in STAGE_COLUMN ? STAGE_COLUMN[type.split(":")[0]] : 1;
}

function layoutNodes(entries: BlueprintNode[], originX = 80, originY = 140) {
  const perColumn = new Map<number, number>();
  return entries.map((entry, index) => {
    const column = stageOf(entry.type);
    const row = perColumn.get(column) ?? 0;
    perColumn.set(column, row + 1);
    return {
      entry,
      column,
      position: { x: originX + column * 280, y: originY + row * 150 },
      index,
    };
  });
}

/** Materialize a blueprint into canvas nodes, offset clear of any existing work.
 *  Returns null only when nothing in the blueprint maps to the palette. */
function blueprintToCanvas(
  blueprint: Blueprint,
  offset = 0,
): { nodes: Node<MLNodeData>[]; edges: Edge[] } | null {
  const placed = layoutNodes(blueprint.nodes);
  const stamp = Date.now();
  const nodes: Node<MLNodeData>[] = [];
  const edges: Edge[] = [];
  // id of the most recent node placed in each stage column
  const lastInColumn = new Map<number, string>();

  placed.forEach(({ entry, column, position }, order) => {
    const item = getPaletteItem(entry.type);
    if (!item) return;
    const id = `${entry.type}-ai-${stamp}-${order}`;
    nodes.push({
      id,
      type: entry.type === "data:db" ? "dbSource" : "custom",
      position: { x: position.x + offset, y: position.y },
      data: {
        type: item.type,
        label: item.label,
        description: entry.reason || item.description,
        category: item.category,
        icon: item.icon,
        accent: item.accent,
        params: item.params ? item.params.map((p) => ({ ...p })) : undefined,
      },
    });
    // Wire from the most recent node in an earlier stage, so the pipeline reads
    // left-to-right across stage columns instead of a straight chain.
    let sourceId: string | undefined;
    let sourceColumn = -1;
    for (const [col, candidate] of lastInColumn) {
      if (col < column && col > sourceColumn) {
        sourceColumn = col;
        sourceId = candidate;
      }
    }
    if (sourceId) {
      edges.push({
        id: `e-${sourceId}-${id}`,
        source: sourceId,
        target: id,
        type: "smoothstep",
        style: { strokeWidth: 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-2)", width: 14, height: 14 },
      });
    }
    lastInColumn.set(column, id);
  });

  return nodes.length ? { nodes, edges } : null;
}

type ApplyDiff = {
  added: number;
  edgesAdded: number;
  existingKept: number;
  duplicates: number;
  sideBySide: boolean;
};

/** Compare a blueprint against what is already on the canvas so the user can see
 *  the consequence before anything is written. */
function planApply(blueprint: Blueprint, project: SavedProject | null): ApplyDiff {
  const built = blueprintToCanvas(blueprint);
  const existingTypes = new Set((project?.nodes ?? []).map((n) => (n.data as MLNodeData).type));
  const existing = project?.nodes.length ?? 0;
  const added = built?.nodes.length ?? 0;
  const duplicates = built
    ? built.nodes.filter((n) => existingTypes.has((n.data as MLNodeData).type)).length
    : 0;
  return {
    added,
    edgesAdded: built?.edges.length ?? 0,
    existingKept: existing,
    duplicates,
    // Offset the new graph so it lands beside existing work rather than on top.
    sideBySide: existing > 0,
  };
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function CategoryBadge({ category }: { category: NodeCategory }) {
  const config = CATEGORIES[category];
  return (
    <span
      className="shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
      style={{ borderColor: `${config.accent}40`, color: config.accent, backgroundColor: `${config.accent}12` }}
    >
      {config.label}
    </span>
  );
}

/** A proposed pipeline node rendered as a card. */
function BlueprintNodeCard({ entry, index }: { entry: BlueprintNode; index: number }) {
  const item = getPaletteItem(entry.type);
  if (!item) return null;
  const Icon = resolveIcon(item.icon);
  return (
    <div className="animate-builder-message relative rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-border-strong hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
          style={{ color: item.accent, backgroundColor: `${item.accent}10` }}
        >
          <Icon size={18} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold text-muted-2">{String(index + 1).padStart(2, "0")}</span>
            <p className="truncate text-xs font-bold">{item.label}</p>
          </div>
          <div className="mt-1.5"><CategoryBadge category={item.category} /></div>
          <p className="mt-2 text-[11px] leading-5 text-muted">{entry.reason || item.description}</p>
        </div>
      </div>
      {index < 100 ? (
        <span className="absolute -bottom-2.5 left-1/2 h-5 w-px -translate-x-1/2 bg-border" aria-hidden />
      ) : null}
    </div>
  );
}

/** A ranked algorithm recommendation with a match-score bar. */
function SuggestionCard({ suggestion, rank }: { suggestion: AlgorithmSuggestion; rank: number }) {
  const item = suggestion.type ? getPaletteItem(suggestion.type) : undefined;
  const Icon = item ? resolveIcon(item.icon) : Sparkle;
  const accent = item?.accent ?? "#8b5cf6";
  const pct = Math.round(suggestion.score * 100);
  return (
    <div className="animate-builder-message rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-border-strong hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border"
          style={{ color: accent, backgroundColor: `${accent}10` }}
        >
          <Icon size={16} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold">
              <span className="mr-1.5 font-mono text-[10px] text-muted-2">#{rank}</span>
              {suggestion.algorithm}
            </p>
            <span className="shrink-0 font-mono text-[10px] font-semibold text-muted">{pct}%</span>
          </div>
          {/* Match score bar */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(3, pct)}%`, backgroundColor: accent }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">{suggestion.reason}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function AIBuilder() {
  const router = useRouter();
  const [project, setProject] = useState<SavedProject | null>(null);
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [activeTrace, setActiveTrace] = useState(0);
  const [notice, setNotice] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [blueprintLabel, setBlueprintLabel] = useState("");
  const [streamed, setStreamed] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load the saved project (context only — the architect also works from scratch).
  useEffect(() => {
    const saved = loadProject();
    if (saved) setProject(saved);
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { messages?: BuilderMessage[]; blueprint?: Blueprint | null; blueprintLabel?: string };
        if (Array.isArray(session.messages) && session.messages.length > 0) {
          setMessages(session.messages);
          if (session.blueprint && Array.isArray(session.blueprint.nodes)) setBlueprint(session.blueprint);
          if (typeof session.blueprintLabel === "string") setBlueprintLabel(session.blueprintLabel);
        }
      }
    } catch {
      /* corrupted session — start fresh */
    }
  }, []);

  // Persist the session.
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, blueprint, blueprintLabel }));
    } catch {
      /* storage full or unavailable */
    }
  }, [messages, blueprint, blueprintLabel]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, streamed, trace]);

  // Abort any in-flight stream when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const graphSummary = useMemo(() => toGraphSummary(project), [project]);
  const hasModel = graphSummary.nodes.some((node) => node.category === "classic_ml" || node.category === "deep_learning");
  const diff = useMemo<ApplyDiff>(
    () =>
      blueprint
        ? planApply(blueprint, project)
        : { added: 0, edgesAdded: 0, existingKept: project?.nodes.length ?? 0, duplicates: 0, sideBySide: (project?.nodes.length ?? 0) > 0 },
    [blueprint, project],
  );

  const isCasualMessage = (value: string) => /^(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening|thanks|thank you|help|what can you do)\s*[!.?]*$/i.test(value.trim());
  const casualReply = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith("thank")) return "You’re welcome. When you’re ready, describe the data or prediction problem you want to solve.";
    if (normalized === "help" || normalized.startsWith("what can you do")) return "I can turn an ML goal into a canvas-ready pipeline. Try “predict customer churn” or “forecast weekly demand.”";
    return "Hi — I’m the Datlify Model Architect. Tell me what you want to predict, classify, group, or forecast, and I’ll map it into a pipeline.";
  };

  /** Consume the NDJSON stream: text appears as the model emits it and the
   *  trace reflects work the server actually reported, not a timer. */
  const send = async (suggestion?: string) => {
    const message = (suggestion ?? draft).trim();
    if (!message || loading) return;
    const history = [...messages, { role: "user" as const, content: message }];
    setMessages(history);
    setDraft("");
    setApplied(false);
    setStreamed("");
    setTrace([]);
    setActiveTrace(0);

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setNotice("Working…");

    const commit = (content: string, extra?: Partial<BuilderMessage>) => {
      setMessages((current) => [
        ...current,
        { role: "assistant" as const, content, ...extra },
      ]);
      setStreamed("");
    };

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ message, history, graph: graphSummary }),
      });
      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `The AI architect returned ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pending = "";
      let provider = "local";
      let model = "";
      let sawPlan = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let event: ChatStreamEvent;
          try {
            event = JSON.parse(line) as ChatStreamEvent;
          } catch {
            continue; // partial frame — wait for more bytes
          }

          if (event.type === "trace") {
            setTrace(event.steps);
            setActiveTrace((step) => Math.min(step + 1, event.steps.length - 1));
          } else if (event.type === "delta") {
            pending += event.text;
            setStreamed(pending);
          } else if (event.type === "casual") {
            commit(event.text);
            setNotice("Ready for your ML brief");
          } else if (event.type === "blueprint") {
            sawPlan = true;
            if (event.blueprint?.nodes?.length) {
              setBlueprint(event.blueprint);
              setBlueprintLabel(message.length > 42 ? `${message.slice(0, 42)}…` : message);
            }
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            provider = event.provider;
            model = event.model;
          }
        }
      }

      if (pending.trim()) {
        commit(pending.trim(), sawPlan && blueprint ? { blueprint } : undefined);
      } else if (!sawPlan) {
        commit("I couldn't produce a pipeline for that. Try describing the target you want to predict.");
        setNotice("No plan returned");
      }
      setNotice(
        sawPlan
          ? provider === "opencode-zen"
            ? `Blueprint ready — ${model}`
            : "Blueprint ready — local heuristic planner"
          : "Response received",
      );
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      const text = error instanceof Error ? error.message : "The AI architect failed.";
      commit(text);
      setNotice("The request could not be completed");
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  /** Add the blueprint to the canvas without destroying existing work. */
  const applyToCanvas = () => {
    if (!blueprint || applying) return;
    const diff = planApply(blueprint, project);
    const built = blueprintToCanvas(blueprint, diff.sideBySide ? 1400 : 0);
    if (!built) {
      setNotice("The blueprint contains no valid palette nodes");
      return;
    }
    setApplying(true);
    try {
      if (diff.sideBySide && project) {
        // Keep the user's existing pipeline and place the new one beside it.
        saveProject([...project.nodes, ...built.nodes], [...project.edges, ...built.edges], "Datlify Pipeline");
      } else {
        saveProject(built.nodes, built.edges, "AI Architect Blueprint");
      }
      setApplied(true);
      setNotice(diff.sideBySide ? `Added ${built.nodes.length} nodes beside your pipeline` : `Created ${built.nodes.length} nodes`);
      window.setTimeout(() => router.push("/canvas?load=1"), 650);
    } catch {
      setApplying(false);
      setNotice("Could not save the blueprint in browser storage");
    }
  };

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-[100dvh] lg:min-h-[620px] lg:overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-neutral-200/80 bg-white/90 px-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)] glass-panel dark:border-white/[0.07] dark:bg-[#070b11]/85 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/canvas" aria-label="Back to canvas" title="Back to canvas" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white">
            <ArrowLeft size={15} weight="bold" />
          </Link>

          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-transparent">
              <Image src="/datlify-mark.png" alt="Datlify" width={40} height={40} className="h-full w-full object-contain p-1 brightness-0 dark:invert" priority />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">AI Model Architect</span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted sm:block">Turn a brief into a canvas-ready plan</span>
            </div>
            {project ? (
              <span className="hidden max-w-52 truncate border-l border-border pl-2.5 font-mono text-[11px] text-muted sm:inline">
                {project.title} · {graphSummary.nodes.length} steps{hasModel ? " · model ✓" : ""}
              </span>
            ) : (
              <span className="hidden border-l border-border pl-2.5 font-mono text-[11px] text-muted sm:inline">no saved pipeline — starting fresh</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 font-mono text-[10px] text-muted-2 md:flex">
            <span>{blueprint ? `${blueprint.nodes.length} proposed nodes` : "no blueprint yet"}</span>
            <span className="h-2.5 w-px bg-border" />
            <span>{blueprint ? `${blueprint.suggestions.length} algorithms ranked` : "—"}</span>
          </div>
          <button
            type="button"
            onClick={applyToCanvas}
            disabled={!blueprint || applying || loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-xs font-bold text-white transition-all hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {applying || applied ? <Check size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
            {applying ? "Applying…" : applied ? "Applied" : "Apply to canvas"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:p-4 lg:pt-3">
        {/* Chat column */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-neutral-200/80 bg-white/90 max-lg:max-h-[55vh] lg:w-[420px] lg:rounded-2xl lg:border lg:shadow-sm dark:border-white/[0.07] dark:bg-[#080c12]/80">
          <div className="border-b border-neutral-200/80 bg-white/45 px-5 py-4 lg:rounded-t-2xl lg:px-6 lg:py-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Design session</div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Ready</span>
            </div>
            <p className="mt-1.5 hidden text-xs leading-6 text-muted sm:block">
              Describe the ML problem you want to solve. I’ll map it into a canvas-ready plan when you ask.
            </p>
          </div>

          <div ref={scrollRef} className="scroll-thin min-h-[120px] flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:min-h-0">
            {messages.length === 0 ? (
              <div className="animate-builder-message rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-bold"><ChatCenteredDots size={15} className="text-muted" /> Describe your ML task</p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  {project
                    ? `Your saved pipeline (${graphSummary.nodes.length} nodes) is attached as context. Ask for a redesign, an upgrade, or algorithm advice.`
                    : "No saved pipeline yet — no problem. The architect designs complete pipelines from scratch, ready to apply to the canvas."}
                </p>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`animate-builder-message flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] whitespace-pre-wrap px-4 py-3 text-xs leading-6 shadow-sm ${message.role === "user" ? "rounded-2xl rounded-br-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "rounded-2xl rounded-bl-lg border border-border bg-card text-foreground-2"}`}>
                  {message.content}
                  {message.blueprint && !message.content ? (
                    <span className="mt-2 block font-mono text-[9px] font-medium text-muted-2">{message.blueprint.nodes.length} nodes proposed in blueprint</span>
                  ) : null}
                </div>
              </div>
            ))}
            {/* Live stream: text as the model emits it, not a fake typewriter. */}
            {loading ? (
              <div className="animate-builder-message flex justify-start">
                <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-lg border border-border bg-card px-4 py-3 text-xs leading-6 text-foreground-2 shadow-sm">
                  {streamed || <span className="text-muted">Thinking…</span>}
                  {streamed ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-current align-middle opacity-60" /> : null}
                </div>
              </div>
            ) : null}
            {/* Real trace: steps the server reported, in the order it reported them. */}
            {loading && trace.length > 0 ? (
              <div className="animate-builder-message space-y-2 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                {trace.map((step, index) => {
                  const done = index < activeTrace;
                  const active = index === activeTrace;
                  return (
                    <div key={`${step.label}-${index}`} className={`flex items-start gap-2.5 text-[11px] transition-colors duration-300 ${done ? "text-muted" : active ? "text-foreground" : "text-muted-2 opacity-50"}`}>
                      {done ? <Check size={13} weight="bold" className="mt-0.5 shrink-0 text-emerald-500" /> : active ? <CircleNotch size={13} className="mt-0.5 shrink-0 animate-spin text-foreground" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-[3px] border border-border-strong" />}
                      <span className="min-w-0">
                        <span className="font-semibold">{step.label}</span>
                        {step.detail ? <span className="ml-1.5 font-mono text-[9px] text-muted-2">{step.detail}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="border-t border-neutral-200/80 bg-white/45 p-4 sm:p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="mb-3 hidden items-center justify-between sm:flex">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-2">Start with an example</span>
              <span className="text-[10px] text-muted-2">No setup required</span>
            </div>
            <div className="mb-3 hidden flex-wrap gap-1.5 sm:flex">
              {SUGGESTION_CHIPS.map((suggestion) => (
                <button key={suggestion} type="button" disabled={loading} onClick={() => void send(suggestion)} className="rounded-full border border-neutral-200 bg-white/50 px-3 py-1.5 text-left text-[11px] font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900 active:scale-[0.98] disabled:opacity-50 dark:border-white/[0.09] dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-white">
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 transition-colors duration-300 focus-within:border-neutral-400 dark:border-white/[0.09] dark:bg-white/[0.03] dark:focus-within:border-white/30">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                disabled={loading}
                rows={3}
                placeholder="Describe the ML pipeline you want…"
                className="w-full resize-none bg-transparent px-1 text-xs leading-6 outline-none placeholder:text-muted-2"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="hidden items-center gap-1.5 text-[10px] text-muted-2 sm:flex">
                  <kbd className="rounded-md border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd> send
                  <kbd className="ml-1 rounded-md border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> new line
                </span>
                <button type="button" aria-label="Send request" onClick={() => void send()} disabled={!draft.trim() || loading} className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                  <PaperPlaneRight size={14} weight="fill" />
                </button>
              </div>
            </div>
            {notice ? (
              <p className="animate-fade-in mt-2 truncate text-[10px] text-muted">{notice}</p>
            ) : null}
          </div>
        </aside>

        {/* Blueprint column */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background-2/80 lg:ml-4 lg:rounded-2xl lg:border lg:border-neutral-200/80 lg:shadow-sm dark:lg:border-white/[0.07]">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white/45 px-6 lg:rounded-t-2xl dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Blueprint</span>
              {blueprintLabel ? (
                <span className="max-w-64 truncate rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">{blueprintLabel}</span>
              ) : null}
            </div>
            <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white/50 px-3 text-[11px] font-semibold text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900 active:scale-[0.98] dark:border-white/[0.09] dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-white">
              {historyOpen ? "Hide algorithms" : "Show algorithms"}
              <CaretDown size={10} className={`transition-transform duration-200 ${historyOpen ? "" : "-rotate-90"}`} />
            </button>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-6">
            {blueprint ? (
              <div className="mx-auto max-w-3xl space-y-8">
                {/* Proposed pipeline */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                    <span className="h-px w-6 bg-border" /> Proposed pipeline · {blueprint.nodes.length} nodes
                  </p>
                  <div className="space-y-5">
                    {blueprint.nodes.map((entry, index) => (
                      <BlueprintNodeCard key={`${entry.type}-${index}`} entry={entry} index={index} />
                    ))}
                  </div>
                </div>

                {/* Algorithm suggestions */}
                {historyOpen && blueprint.suggestions.length > 0 ? (
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                      <span className="h-px w-6 bg-border" /> Recommended algorithms · ranked by fit
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {blueprint.suggestions.map((suggestion, index) => (
                        <SuggestionCard key={`${suggestion.algorithm}-${index}`} suggestion={suggestion} rank={index + 1} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Apply CTA */}
                <div className="rounded-2xl border border-neutral-200 bg-white/65 p-5 dark:border-white/[0.07] dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">Ready when you are</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        {diff.sideBySide
                          ? `Adds ${diff.added} nodes and ${diff.edgesAdded} connections beside your ${diff.existingKept} existing nodes — nothing is overwritten.`
                          : `Creates ${diff.added} nodes with ${diff.edgesAdded} chained connections.`}
                      </p>
                      {diff.duplicates > 0 ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-2">
                          {diff.duplicates} node{diff.duplicates > 1 ? "s" : ""} of a type you already have — still added, just flagged.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={applyToCanvas}
                      disabled={applying || loading}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-xs font-bold text-white transition-all hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      {applying || applied ? <Check size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
                      {applying ? "Applying…" : applied ? "Applied — opening canvas" : diff.sideBySide ? "Add to canvas" : "Create on canvas"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-5">
                <div className="animate-builder-panel max-w-lg rounded-3xl border border-neutral-200/70 bg-card/90 p-10 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/[0.07]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
                    <Image src="/datlify-mark.png" alt="Datlify" width={28} height={28} className="h-7 w-7 object-contain p-0.5 brightness-0 dark:invert" />
                  </div>
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Workspace ready</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight">What are you building?</h2>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    Start with a plain-English goal. Datlify will turn it into a pipeline you can review, edit, and run on the canvas.
                  </p>
                  <div className="mt-6 grid gap-2 text-left">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button key={chip} type="button" disabled={loading} onClick={() => void send(chip)} className="rounded-xl border border-neutral-200 bg-white/50 px-4 py-2.5 text-[11px] font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900 active:scale-[0.98] disabled:opacity-50 dark:border-white/[0.09] dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-white">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AIBuilder;
