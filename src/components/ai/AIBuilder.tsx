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
  Robot,
  Sparkle,
} from "@phosphor-icons/react";
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
};

const SESSION_KEY = "neuralforge:aibuilder:v2";

/** Agent phases shown while a request is in flight. */
const AGENT_STEPS = [
  { label: "Reading canvas context", hint: "saved nodes, params, dataset" },
  { label: "Selecting node types", hint: "data → preprocessing → model → viz" },
  { label: "Ranking algorithms", hint: "match score + rationale" },
  { label: "Assembling blueprint", hint: "validating against the palette" },
];

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

/** Materialize a blueprint into real canvas nodes + chained edges. */
function blueprintToCanvas(blueprint: Blueprint): { nodes: Node<MLNodeData>[]; edges: Edge[] } | null {
  const nodes: Node<MLNodeData>[] = [];
  const edges: Edge[] = [];
  const stamp = Date.now();

  blueprint.nodes.forEach((entry, index) => {
    const item = getPaletteItem(entry.type);
    if (!item) return;
    const id = `${entry.type}-ai-${stamp}-${index}`;
    nodes.push({
      id,
      type: entry.type === "data:db" ? "dbSource" : "custom",
      position: { x: 80 + index * 260, y: 140 + (index % 2) * 40 },
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
    if (index > 0 && nodes.length > 1) {
      const source = nodes[nodes.length - 2];
      edges.push({
        id: `e-${source.id}-${id}`,
        source: source.id,
        target: id,
        type: "smoothstep",
        style: { strokeWidth: 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-2)", width: 14, height: 14 },
      });
    }
  });

  return nodes.length ? { nodes, edges } : null;
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
  const [agentStep, setAgentStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [blueprintLabel, setBlueprintLabel] = useState("");
  const [typedText, setTypedText] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typeTimerRef = useRef<number | null>(null);

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
  }, [messages, loading, typedText]);

  // Simulated agent activity while the request is in flight.
  useEffect(() => {
    if (!loading) return;
    setAgentStep(0);
    const timer = window.setInterval(() => {
      setAgentStep((step) => Math.min(step + 1, AGENT_STEPS.length - 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, [loading]);

  const graphSummary = useMemo(() => toGraphSummary(project), [project]);
  const hasModel = graphSummary.nodes.some((node) => node.category === "classic_ml" || node.category === "deep_learning");

  const isCasualMessage = (value: string) => /^(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening|thanks|thank you|help|what can you do)\s*[!.?]*$/i.test(value.trim());
  const casualReply = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith("thank")) return "You’re welcome. When you’re ready, describe the data or prediction problem you want to solve.";
    if (normalized === "help" || normalized.startsWith("what can you do")) return "I can turn an ML goal into a canvas-ready pipeline. Try “predict customer churn” or “forecast weekly demand.”";
    return "Hi — I’m the Datlify Model Architect. Tell me what you want to predict, classify, group, or forecast, and I’ll map it into a pipeline.";
  };

  /** Reveal the reply progressively so responses feel streamed. */
  const typewrite = useCallback((full: string) => {
    if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
    let shown = 0;
    setTypedText(full.slice(0, 0));
    typeTimerRef.current = window.setInterval(() => {
      shown += Math.max(2, Math.round(full.length / 48));
      if (shown >= full.length) {
        window.clearInterval(typeTimerRef.current!);
        typeTimerRef.current = null;
        setTypedText(null);
        setMessages((current) => current.map((m, i) => (i === current.length - 1 && m.role === "assistant" ? { ...m, content: full } : m)));
      } else {
        setTypedText(full.slice(0, shown));
      }
    }, 18);
  }, []);

  useEffect(() => () => { if (typeTimerRef.current) window.clearInterval(typeTimerRef.current); }, []);

  const send = async (suggestion?: string) => {
    const message = (suggestion ?? draft).trim();
    if (!message || loading) return;
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setDraft("");
    setApplied(false);
    if (isCasualMessage(message)) {
      setMessages([...next, { role: "assistant" as const, content: casualReply(message) }]);
      setNotice("Ready for your ML brief");
      return;
    }
    setLoading(true);
    setNotice("Designing your pipeline…");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: next, graph: graphSummary }),
      });
      const result = (await response.json()) as { reply?: string; blueprint?: Blueprint; error?: string; casual?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The AI architect could not respond.");
      const reply = result.reply ?? "I designed a pipeline for you.";
      if (result.casual) {
        setMessages((current) => [...current, { role: "assistant", content: reply }]);
        setNotice("Ready for your ML brief");
        return;
      }
      if (result.blueprint && Array.isArray(result.blueprint.nodes) && result.blueprint.nodes.length > 0) {
        setBlueprint(result.blueprint);
        setBlueprintLabel(message.length > 42 ? `${message.slice(0, 42)}…` : message);
      }
      setMessages((current) => [...current, { role: "assistant", content: "", ...(result.blueprint ? { blueprint: result.blueprint } : {}) }]);
      typewrite(reply);
      setNotice(result.blueprint ? `Blueprint ready — ${result.blueprint.nodes.length} nodes proposed` : "Response received");
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The AI architect failed." }]);
      setNotice("The request could not be completed");
    } finally {
      setLoading(false);
    }
  };

  /** Materialize the blueprint into real canvas nodes and jump to the canvas. */
  const applyToCanvas = () => {
    if (!blueprint || applying) return;
    const canvas = blueprintToCanvas(blueprint);
    if (!canvas) {
      setNotice("The blueprint contains no valid palette nodes");
      return;
    }
    setApplying(true);
    try {
      saveProject(canvas.nodes, canvas.edges, "AI Architect Blueprint");
      setApplied(true);
      setNotice("Blueprint applied — opening the canvas…");
      window.setTimeout(() => router.push("/canvas?load=1"), 650);
    } catch {
      setApplying(false);
      setNotice("Could not save the blueprint in browser storage");
    }
  };

  return (
    <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-surface/80 px-5 shadow-[0_12px_36px_-30px_rgba(15,23,42,0.7)] lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/canvas" aria-label="Back to canvas" title="Back to canvas" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/50 text-muted transition-all hover:border-border-strong hover:bg-foreground/[0.04] hover:text-foreground">
            <ArrowLeft size={14} weight="bold" />
          </Link>
          <div className="h-6 w-px bg-border/70" />
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.08] text-primary shadow-sm">
              <Robot size={16} weight="duotone" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-semibold tracking-tight">AI Model Architect</span>
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
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border/70 bg-surface/75 lg:w-[420px] lg:rounded-2xl lg:border lg:shadow-sm">
          <div className="border-b border-border/70 bg-primary/[0.03] px-6 py-6 lg:rounded-t-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Design session</div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Ready</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted">
              Describe the ML problem you want to solve. I’ll map it into a canvas-ready plan when you ask.
            </p>
          </div>

          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="animate-builder-message rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-bold"><ChatCenteredDots size={15} className="text-primary" /> Describe your ML task</p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  {project
                    ? `Your saved pipeline (${graphSummary.nodes.length} nodes) is attached as context. Ask for a redesign, an upgrade, or algorithm advice.`
                    : "No saved pipeline yet — no problem. The architect designs complete pipelines from scratch, ready to apply to the canvas."}
                </p>
              </div>
            ) : null}
            {messages.map((message, index) => {
              const isLastAssistantTyping = typedText !== null && index === messages.length - 1 && message.role === "assistant";
              const text = isLastAssistantTyping ? typedText : message.content;
              return (
                <div key={`${message.role}-${index}`} className={`animate-builder-message flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] whitespace-pre-wrap px-4 py-3 text-xs leading-6 shadow-sm ${message.role === "user" ? "rounded-2xl rounded-br-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "rounded-2xl rounded-bl-lg border border-border bg-card text-foreground-2"}`}>
                    {text}
                    {isLastAssistantTyping ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-full bg-current align-middle opacity-60" /> : null}
                    {message.blueprint && !isLastAssistantTyping ? (
                      <span className="mt-2 block font-mono text-[9px] font-medium text-muted-2">{message.blueprint.nodes.length} nodes proposed in blueprint</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {loading ? (
              <div className="animate-builder-message space-y-2 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                {AGENT_STEPS.map((step, index) => {
                  const done = index < agentStep;
                  const active = index === agentStep;
                  return (
                    <div key={step.label} className={`flex items-start gap-2.5 text-[11px] transition-colors duration-300 ${done ? "text-muted" : active ? "text-foreground" : "text-muted-2 opacity-50"}`}>
                      {done ? <Check size={13} weight="bold" className="mt-0.5 shrink-0 text-emerald-500" /> : active ? <CircleNotch size={13} className="mt-0.5 shrink-0 animate-spin text-foreground" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-[3px] border border-border-strong" />}
                      <span className="min-w-0">
                        <span className="font-semibold">{step.label}</span>
                        {active ? <span className="ml-1.5 font-mono text-[9px] text-muted-2">{step.hint}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/70 bg-surface/45 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-2">Start with an example</span>
              <span className="text-[10px] text-muted-2">No setup required</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SUGGESTION_CHIPS.map((suggestion) => (
                <button key={suggestion} type="button" disabled={loading} onClick={() => void send(suggestion)} className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-left text-[11px] font-medium text-muted transition-all hover:border-border-strong hover:text-foreground disabled:opacity-50">
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-input bg-background/70 p-3.5 transition-all focus-within:border-primary/40 focus-within:shadow-[0_0_24px_-8px_var(--glow-primary)] focus-within:ring-2 focus-within:ring-ring/30">
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
                <span className="flex items-center gap-1.5 text-[10px] text-muted-2">
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
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background-2/80 lg:ml-4 lg:rounded-2xl lg:border lg:border-border/70 lg:shadow-sm">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-surface/65 px-6 lg:rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Blueprint</span>
              {blueprintLabel ? (
                <span className="max-w-64 truncate rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">{blueprintLabel}</span>
              ) : null}
            </div>
            <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/80 bg-background/45 px-3 text-[11px] font-semibold text-foreground-2 transition-all hover:border-border-strong hover:bg-foreground/[0.04] hover:text-foreground active:scale-[0.98]">
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
                <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">Ready when you are</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        Applying creates {blueprint.nodes.length} real canvas nodes with chained connections, saved as "AI Architect Blueprint".
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={applyToCanvas}
                      disabled={applying || loading}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-xs font-bold text-white transition-all hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      {applying || applied ? <Check size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
                      {applying ? "Applying…" : applied ? "Applied — opening canvas" : "Apply to canvas"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-5">
                <div className="animate-builder-panel max-w-lg rounded-3xl border border-border/70 bg-card/90 p-10 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                    <Robot size={24} weight="duotone" />
                  </div>
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Workspace ready</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight">What are you building?</h2>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    Start with a plain-English goal. Datlify will turn it into a pipeline you can review, edit, and run on the canvas.
                  </p>
                  <div className="mt-6 grid gap-2 text-left">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button key={chip} type="button" disabled={loading} onClick={() => void send(chip)} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[11px] font-medium text-muted transition-all hover:border-border-strong hover:text-foreground disabled:opacity-50">
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
