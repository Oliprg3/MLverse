"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowsCounterClockwise,
  BookOpen,
  BracketsCurly,
  CaretDown,
  ChatCenteredDots,
  Check,
  CircleNotch,
  Code,
  Copy,
  DownloadSimple,
  FileJs,
  FilePy,
  FileText,
  Gear,
  Monitor,
  PaperPlaneRight,
  Robot,
  Sparkle,
} from "@phosphor-icons/react";
import { loadProject, type SavedProject } from "@/lib/projectStorage";
import { generateAppFiles, type ScaffoldFile } from "@/lib/appScaffold";
import { generateCode } from "@/lib/codeGen";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import type { GraphPayload, MLNodeData } from "@/lib/types";

type BuilderMessage = {
  role: "user" | "assistant";
  content: string;
  versionId?: string;
};

type UiField = { key: string; label: string; type: "number" | "text" | "select"; placeholder?: string; options?: string[] };
type UiSpec = {
  brand: string;
  nav: string[];
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  accent: "sky" | "violet" | "emerald";
  fields: UiField[];
  stats: Array<{ label: string; value: string; detail: string }>;
  features: Array<{ title: string; description: string; icon: "shield" | "activity" | "spark" }>;
  insight: { title: string; description: string };
};

type SpecVersion = { id: string; label: string; at: number; spec: UiSpec };

const SESSION_KEY = "neuralforge:aibuilder:v1";

/** Agent phases shown while a request is in flight. */
const AGENT_STEPS = [
  { label: "Reading saved pipeline", hint: "nodes · params · dataset context" },
  { label: "Drafting interface spec", hint: "layout · copy · field structure" },
  { label: "Validating fields", hint: "types · options · empty states" },
  { label: "Applying changes", hint: "hot-swapping the live preview" },
];

function toGraph(project: SavedProject): GraphPayload {
  return {
    nodes: project.nodes.map((node) => {
      const data = node.data as MLNodeData;
      return { id: node.id, type: data.type, category: data.category, label: data.label, params: data.params ? Object.fromEntries(data.params.map((param) => [param.key, param.value])) : undefined, dataset: data.dataset, imageDataset: data.imageDataset, position: node.position };
    }),
    edges: project.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    meta: { title: project.title, created_at: project.savedAt },
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return "Saved in browser";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Sensible starting point so the preview is meaningful before the first chat message. */
function defaultSpec(modelName: string, format: string): UiSpec {
  return {
    brand: "NeuralForge",
    nav: ["Overview", "Predict", "Activity"],
    eyebrow: `${format.toUpperCase()} MODEL WORKSPACE`,
    title: `${modelName.replace(/\.(pkl|pickle|onnx)$/i, "")} prediction`,
    description: "A focused web application generated around your trained model. Chat with the assistant to refine this experience.",
    submitLabel: "Run prediction",
    accent: format === "onnx" ? "violet" : "sky",
    fields: [
      { key: "feature_1", label: "Feature 1", type: "number", placeholder: "Enter a value" },
      { key: "feature_2", label: "Feature 2", type: "number", placeholder: "Enter a value" },
      { key: "category", label: "Category", type: "select", options: ["Option A", "Option B"] },
    ],
    stats: [
      { label: "Model status", value: "Ready", detail: "Artifact loaded" },
      { label: "Runtime", value: format.toUpperCase(), detail: "Serving target" },
      { label: "Inputs", value: "03", detail: "Configurable fields" },
    ],
    features: [
      { title: "Private by design", description: "Your model artifact stays in this browser session.", icon: "shield" },
      { title: "Fast feedback", description: "Validate the prediction experience before connecting inference.", icon: "activity" },
      { title: "Built for iteration", description: "Keep refining layout, copy, and behavior through chat.", icon: "spark" },
    ],
    insight: { title: "Ready for your first prediction", description: "Complete the fields to preview the result state." },
  };
}

/** Renders the UiSpec as a believable website inside a browser-chrome frame. */
function AppPreview({ spec }: { spec: UiSpec }) {
  const ACCENTS = {
    sky: { text: "text-sky-600 dark:text-sky-400", chip: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300", soft: "bg-sky-500/10", solid: "bg-sky-600 hover:bg-sky-500 text-white", dot: "bg-sky-500", glow: "shadow-[0_8px_30px_-12px_rgba(14,165,233,0.45)]" },
    violet: { text: "text-violet-600 dark:text-violet-400", chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300", soft: "bg-violet-500/10", solid: "bg-violet-600 hover:bg-violet-500 text-white", dot: "bg-violet-500", glow: "shadow-[0_8px_30px_-12px_rgba(139,92,246,0.45)]" },
    emerald: { text: "text-emerald-600 dark:text-emerald-400", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", soft: "bg-emerald-500/10", solid: "bg-emerald-600 hover:bg-emerald-500 text-white", dot: "bg-emerald-500", glow: "shadow-[0_8px_30px_-12px_rgba(16,185,129,0.45)]" },
  } as const;
  const a = ACCENTS[spec.accent] ?? ACCENTS.sky;
  const [values, setValues] = useState<Record<string, string>>({});
  const [ran, setRan] = useState(false);

  return (
    <div className={`animate-builder-panel overflow-hidden rounded-2xl border border-border bg-card shadow-xl ${a.glow}`}>
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="mx-auto flex max-w-xs flex-1 items-center justify-center gap-1.5 truncate rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.dot}`} />
          {spec.brand.toLowerCase().replace(/\s+/g, "")}.app
        </div>
        <div className="w-10" />
      </div>

      {/* Site nav */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${a.soft} ${a.text}`}><Sparkle size={13} weight="fill" /></span>
          {spec.brand}
        </span>
        <nav className="hidden items-center gap-5 sm:flex">
          {spec.nav.map((item) => (
            <span key={item} className="cursor-default text-xs font-medium text-muted transition-colors hover:text-foreground">{item}</span>
          ))}
        </nav>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${a.chip}`}>{spec.eyebrow.split(" ")[0]}</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden px-6 py-8 sm:px-10">
        <div className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-[0.07] blur-2xl ${a.dot}`} />
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${a.text}`}>{spec.eyebrow}</p>
        <h1 className="mt-2 max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{spec.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{spec.description}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 px-6 pb-2 sm:grid-cols-3 sm:px-10">
        {spec.stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4 transition-transform duration-200 hover:-translate-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{stat.label}</p>
            <p className={`mt-1.5 text-xl font-bold tracking-tight ${a.text}`}>{stat.value}</p>
            <p className="mt-0.5 text-[10px] text-muted-2">{stat.detail}</p>
          </div>
        ))}
      </div>

      {/* Form + insight */}
      <div className="grid gap-5 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">Prediction input</p>
          <div className="mt-4 space-y-3.5">
            {spec.fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground-2">{field.label}</span>
                {field.type === "select" ? (
                  <select
                    value={values[field.key] ?? ""}
                    onChange={(event) => { setValues((v) => ({ ...v, [field.key]: event.target.value })); setRan(false); }}
                    className="w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring"
                  >
                    <option value="" disabled>Select…</option>
                    {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder ?? ""}
                    onChange={(event) => { setValues((v) => ({ ...v, [field.key]: event.target.value })); setRan(false); }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none transition-shadow placeholder:text-muted-2 focus:border-transparent focus:ring-2 focus:ring-ring"
                  />
                )}
              </label>
            ))}
            <button
              type="button"
              onClick={() => setRan(true)}
              className={`mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${a.solid}`}
            >
              {ran ? <Check size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />} {ran ? "Prediction complete" : spec.submitLabel}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 ${a.chip}`}>
            <p className="text-sm font-semibold">{spec.insight.title}</p>
            <p className="mt-1.5 text-xs leading-5 opacity-80">{spec.insight.description}</p>
            {ran ? (
              <div className="animate-builder-message mt-3 rounded-lg border border-current/20 bg-background/60 px-3 py-2 text-[11px] font-medium">
                Result state rendered — connect a serving endpoint to stream real predictions here.
              </div>
            ) : null}
          </div>
          <div className="grid gap-2.5">
            {spec.features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${a.soft} ${a.text}`}>
                  {feature.icon === "shield" ? <Monitor size={14} /> : feature.icon === "activity" ? <Code size={14} /> : <Sparkle size={14} weight="fill" />}
                </span>
                <div>
                  <p className="text-xs font-semibold">{feature.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIBuilder() {
  const [project, setProject] = useState<SavedProject | null>(null);
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("neuralforge_pipeline.py");
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [loading, setLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [uiSpec, setUiSpec] = useState<UiSpec | null>(null);
  const [versions, setVersions] = useState<SpecVersion[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [typedText, setTypedText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typeTimerRef = useRef<number | null>(null);

  // Restore session (thread + versions) when it matches the saved project.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = loadProject();
      if (cancelled || !saved) return;
      setProject(saved);
      const generated = generateCode(toGraph(saved));
      setCode(generated.code);
      setFilename(generated.filename);
      const modelNode = saved.nodes.find((node) => (node.data as MLNodeData).category === "classic_ml" || (node.data as MLNodeData).category === "deep_learning");
      const base = defaultSpec((modelNode?.data as MLNodeData | undefined)?.label ?? "Saved model", (modelNode?.data as MLNodeData | undefined)?.category === "deep_learning" ? "onnx" : "pickle");
      try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as { projectTitle?: string; messages?: BuilderMessage[]; versions?: SpecVersion[] };
          if (session.projectTitle === saved.title && Array.isArray(session.versions) && session.versions.length > 0 && typeof session.versions[0]?.spec?.title === "string") {
            if (cancelled) return;
            setMessages(session.messages ?? []);
            setVersions(session.versions);
            setUiSpec(session.versions[session.versions.length - 1].spec);
            return;
          }
        }
      } catch {
        /* corrupted session — fall through to defaults */
      }
      if (cancelled) return;
      setUiSpec(base);
      setVersions([{ id: "v0", label: "Initial layout", at: Date.now(), spec: base }]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist thread + versions per project.
  useEffect(() => {
    if (!project || versions.length === 0) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ projectTitle: project.title, messages, versions }));
    } catch {
      /* storage full or unavailable */
    }
  }, [project, messages, versions]);

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

  const graph = useMemo(() => project ? toGraph(project) : null, [project]);
  const modelNode = project?.nodes.find((node) => (node.data as MLNodeData).category === "classic_ml" || (node.data as MLNodeData).category === "deep_learning");
  const modelData = modelNode?.data as MLNodeData | undefined;
  const modelLabel = modelData?.label ?? "Saved model";
  const model = modelData ? { name: modelData.label, format: "pickle" as const, size: 0 } : null;
  const suggestions = ["Create a polished prediction dashboard", "Switch the accent color to violet", "Add validation and a clear result state", "Make it feel like a medical product"];
  const appFiles = useMemo<ScaffoldFile[]>(
    () => (uiSpec ? generateAppFiles(uiSpec, { name: modelLabel, format: modelData?.category === "deep_learning" ? "onnx" : "pickle" }, { trainingCode: code }) : []),
    [uiSpec, modelLabel, modelData, code],
  );

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
        setMessages((current) => current.map((m, i) => i === current.length - 1 && m.role === "assistant" ? { ...m, content: full } : m));
      } else {
        setTypedText(full.slice(0, shown));
      }
    }, 18);
  }, []);

  useEffect(() => () => { if (typeTimerRef.current) window.clearInterval(typeTimerRef.current); }, []);

  const send = async (suggestion?: string) => {
    const message = (suggestion ?? draft).trim();
    if (!message || !model || !graph || loading || uiSpec === null) return;
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setDraft("");
    setLoading(true);
    setNotice("Agent is redesigning from your saved pipeline…");
    try {
      // currentUi lets the model iterate on what is already rendered in Preview.
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, model, history: next, currentUi: uiSpec ?? undefined }) });
      const result = (await response.json()) as { reply?: string; ui?: UiSpec; error?: string };
      if (!response.ok) throw new Error(result.error ?? "The AI builder could not respond.");
      const reply = result.reply ?? "I updated the app direction.";
      let versionId: string | undefined;
      if (result.ui) {
        versionId = `v${versions.length}`;
        const version: SpecVersion = { id: versionId, label: message.length > 42 ? `${message.slice(0, 42)}…` : message, at: Date.now(), spec: result.ui };
        setVersions((current) => [...current, version]);
        setUiSpec(result.ui);
        setPreviewNonce((n) => n + 1);
      }
      setMessages((current) => [...current, { role: "assistant", content: "", ...(versionId ? { versionId } : {}) }]);
      setActiveTab("preview");
      setNotice(result.ui?.title ? `Live preview updated · ${result.ui.title}` : "Live preview updated");
      typewrite(reply);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The AI builder failed." }]);
      setNotice("The request could not be completed");
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = (version: SpecVersion) => {
    if (loading) return;
    setUiSpec(version.spec);
    setPreviewNonce((n) => n + 1);
    setActiveTab("preview");
    setNotice(`Restored checkpoint · ${version.label}`);
  };

  const regenerateCode = async () => {
    if (!graph || loading) return;
    setLoading(true);
    setNotice("Generating app code from the saved model…");
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph, currentCode: code, prompt: "Generate the code context for a web app built around this saved model." }) });
      const result = (await response.json()) as { code?: string; filename?: string; message?: string; error?: string };
      if (!response.ok || !result.code) throw new Error(result.error ?? "Code generation failed.");
      setCode(result.code);
      if (result.filename) setFilename(result.filename);
      setActiveTab("code");
      setNotice(result.message ?? "Code generated from the saved pipeline");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Code generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setNotice("Code copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice("Clipboard unavailable in this browser");
    }
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice(`Downloaded ${filename}`);
  };

  if (!project || !graph || !model) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-3xl" />
        <div className="animate-builder-panel relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 shadow-[0_0_24px_-6px_rgba(16,185,129,0.5)]">
            <Robot size={22} />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight">Build with AI</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Save a pipeline with a model node from the canvas first. The builder turns that saved graph into a working app you refine through chat.</p>
          <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
            Opened from the canvas but seeing this? The pipeline could not be shared into the builder — press <span className="font-medium text-foreground-2">Build with AI</span> again after re-opening the canvas. Very large uploaded datasets are trimmed automatically.
          </p>
          <Link href="/canvas" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-500 transition-colors hover:border-emerald-500/70 hover:bg-emerald-500/10">
            <ArrowLeft size={15} weight="bold" /> Back to canvas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/canvas" aria-label="Back to canvas" title="Back to canvas" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground">
            <ArrowLeft size={14} weight="bold" />
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="flex min-w-0 items-center gap-2">
            <Robot size={17} className="shrink-0 text-emerald-500" />
            <span className="truncate text-sm font-semibold">AI Builder</span>
            <span className="hidden max-w-52 truncate border-l border-border pl-2 text-[11px] text-muted sm:inline">{project.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted md:inline-flex">
            {modelLabel} · {formatBytes(model.size)}
          </span>
          <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground-2 transition-all hover:border-border-strong hover:text-foreground active:scale-[0.98]">
            <ArrowsCounterClockwise size={13} /> Checkpoints
            <CaretDown size={10} className={`transition-transform duration-200 ${historyOpen ? "" : "-rotate-90"}`} />
          </button>
          <button type="button" onClick={regenerateCode} disabled={loading} className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-foreground-2 transition-all hover:border-border-strong hover:text-foreground disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]">
            <Code size={14} /> Generate code
          </button>
        </div>
      </header>

      {/* Checkpoints strip */}
      {historyOpen && versions.length > 1 ? (
        <div className="scroll-thin flex shrink-0 items-center gap-4 overflow-x-auto border-b border-border bg-surface/60 px-5 py-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Checkpoints</span>
          {versions.map((version, index) => {
            const active = uiSpec !== null && index === versions.length - 1;
            return (
              <button key={version.id} type="button" onClick={() => restoreVersion(version)} title={`Restore "${version.label}"`} className={`flex shrink-0 items-baseline gap-1.5 text-[11px] transition-colors hover:text-foreground ${active ? "font-medium text-foreground" : "text-muted"}`}>
                <span className="font-mono text-[10px] text-muted-2">{version.id}</span>
                <span className="max-w-44 truncate">{version.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Agent column */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface lg:w-[380px] lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Agent session</div>
            <p className="mt-1.5 text-xs leading-5 text-muted">Describe changes like you would to an engineer — the preview updates with every reply.</p>
          </div>

          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="animate-builder-message rounded-xl border border-dashed border-border-strong bg-card/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold"><ChatCenteredDots size={14} /> Start with a direction</p>
                <p className="mt-1.5 text-xs leading-5 text-muted">Your saved pipeline is attached as context. Ask for layout, copy, or interaction changes.</p>
              </div>
            ) : null}
            {messages.map((message, index) => {
              const isLastAssistantTyping = typedText !== null && index === messages.length - 1 && message.role === "assistant";
              const text = isLastAssistantTyping ? typedText : message.content;
              return (
                <div key={`${message.role}-${index}`} className={`animate-builder-message flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-sm ${message.role === "user" ? "rounded-br-md bg-gradient-to-br from-emerald-600 to-teal-600 text-white" : "rounded-bl-md border border-border bg-card text-foreground-2"}`}>
                    {text}
                    {isLastAssistantTyping ? <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-emerald-400 align-middle" /> : null}
                    {message.versionId && !isLastAssistantTyping ? (
                      <span className="mt-1.5 block font-mono text-[9px] text-muted-2">{message.versionId} applied to preview</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {loading ? (
              <div className="animate-builder-message space-y-1.5 rounded-xl border border-border bg-card/70 p-3">
                {AGENT_STEPS.map((step, index) => {
                  const done = index < agentStep;
                  const active = index === agentStep;
                  return (
                    <div key={step.label} className={`flex items-start gap-2 text-[11px] transition-colors duration-300 ${done ? "text-muted" : active ? "text-foreground" : "text-muted-2 opacity-50"}`}>
                      {done ? <Check size={12} weight="bold" className="mt-0.5 shrink-0 text-emerald-500" /> : active ? <CircleNotch size={12} className="mt-0.5 shrink-0 animate-spin text-emerald-500" /> : <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />}
                      <span className="min-w-0">
                        <span className="font-medium">{step.label}</span>
                        {active ? <span className="ml-1.5 font-mono text-[9px] text-muted-2">{step.hint}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-2.5 flex flex-wrap gap-x-3 gap-y-1">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" disabled={loading} onClick={() => void send(suggestion)} className="text-[11px] text-muted transition-colors hover:text-foreground disabled:opacity-50">
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-input bg-background p-2.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/60">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                disabled={loading}
                rows={3}
                placeholder="Describe the app you want…"
                className="w-full resize-none bg-transparent px-1 text-xs leading-5 outline-none placeholder:text-muted-2"
              />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[10px] text-muted-2"><kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> newline</span>
                <button type="button" aria-label="Send request" onClick={() => void send()} disabled={!draft.trim() || loading} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 active:scale-95">
                  <PaperPlaneRight size={13} weight="fill" />
                </button>
              </div>
            </div>
            {notice ? (
              <p className="animate-fade-in mt-2 truncate text-[10px] text-muted">{notice}</p>
            ) : null}
          </div>
        </aside>

        {/* Preview / Code column */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background-2">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(["preview", "code"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium capitalize transition-all duration-200 ${activeTab === tab ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground-2"}`}
                >
                  {tab === "preview" ? <Monitor size={13} /> : <FilePy size={13} />} {tab === "preview" ? "Live preview" : "Code"}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="font-mono text-[10px] text-muted-2">{versions.length} checkpoints · {graph.nodes.length} steps · {graph.edges.length} links</span>
              <span className="hidden text-[10px] text-muted lg:inline">Model context attached</span>
            </div>
          </div>

          {activeTab === "code" ? (
            <CodeExplorer
              files={appFiles}
              trainingFilename={filename}
              trainingCode={code}
              copied={copied}
              onCopyTraining={() => void copyCode()}
              onDownloadFile={(file) => {
                const blob = new Blob([file.content], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.path.split("/").pop() ?? "file.txt";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setNotice(`Downloaded ${file.path}`);
              }}
            />
          ) : (
            <div key="preview" className="scroll-thin min-h-0 flex-1 overflow-auto p-5">
              <div className="mx-auto max-w-4xl pb-6">
                {uiSpec ? <AppPreview key={`${previewNonce}-${versions.length}`} spec={uiSpec} /> : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── VS Code-style project explorer ─────────────────────────────────────── */

/** "Nebula" — a violet-tuned syntax theme matching the app's dark palette. */
const NEBULA_THEME: PrismTheme = {
  plain: { color: "#d8d3ea", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "cdata"], style: { color: "#6f6790", fontStyle: "italic" } },
    { types: ["punctuation"], style: { color: "#8f86ad" } },
    { types: ["keyword", "control", "directive", "unit", "important"], style: { color: "#c4b5fd" } },
    { types: ["builtin", "class-name", "maybe-class-name"], style: { color: "#f0abfc" } },
    { types: ["function", "method", "function-variable"], style: { color: "#7dd3fc" } },
    { types: ["string", "char", "attr-value", "template-string", "triple-quoted-string"], style: { color: "#6ee7b7" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "#fcd34d" } },
    { types: ["operator", "entity", "url"], style: { color: "#a5b4fc" } },
    { types: ["tag"], style: { color: "#7dd3fc" } },
    { types: ["attr-name", "property", "variable"], style: { color: "#e2d9ff" } },
    { types: ["selector", "deleted"], style: { color: "#fca5a5" } },
    { types: ["inserted"], style: { color: "#6ee7b7" } },
    { types: ["bold"], style: { fontWeight: "bold" } },
    { types: ["italic"], style: { fontStyle: "italic" } },
    { types: ["heading"], style: { color: "#c4b5fd", fontWeight: "bold" } },
    { types: ["list", "hr"], style: { color: "#8f86ad" } },
    { types: ["code-snippet", "code"], style: { color: "#6ee7b7" } },
  ],
};

const PRISM_LANG: Record<ScaffoldFile["language"], string> = {
  tsx: "tsx",
  ts: "typescript",
  py: "python",
  json: "json",
  md: "markdown",
  text: "bash",
};

type TreeNode =
  | { kind: "folder"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; name: string; path: string; file: ScaffoldFile };

function buildTree(files: ScaffoldFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    let level = root;
    let prefix = "";
    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i];
      prefix = prefix ? `${prefix}/${name}` : name;
      if (i === parts.length - 1) {
        level.push({ kind: "file", name, path: file.path, file });
      } else {
        let folder = level.find((n): n is Extract<TreeNode, { kind: "folder" }> => n.kind === "folder" && n.name === name);
        if (!folder) {
          folder = { kind: "folder", name, path: prefix, children: [] };
          level.push(folder);
        }
        level = folder.children;
      }
    }
  }
  return root;
}

const EXT_LANGUAGE: Record<string, string> = { tsx: "TypeScript React", ts: "TypeScript", py: "Python", json: "JSON", md: "Markdown", text: "Plain text" };

function FileGlyph({ path }: { path: string }) {
  const ext = path.split(".").pop() ?? "";
  if (ext === "py") return <FilePy size={13} />;
  if (ext === "tsx") return <BracketsCurly size={13} />;
  if (ext === "ts") return <FileJs size={13} />;
  if (ext === "json") return <Gear size={13} />;
  if (ext === "md") return <BookOpen size={13} />;
  return <FileText size={13} />;
}

function CodeExplorer({
  files,
  trainingFilename,
  trainingCode,
  copied,
  onCopyTraining,
  onDownloadFile,
}: {
  files: ScaffoldFile[];
  trainingFilename: string;
  trainingCode: string;
  copied: boolean;
  onCopyTraining: () => void;
  onDownloadFile: (file: ScaffoldFile) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? "");
  const tree = useMemo(() => buildTree(files), [files]);

  // Derive the active file — falls back to the first entry after regeneration.
  const activeFile = files.find((f) => f.path === selectedPath) ?? files[0];

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNodes = (nodes: TreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === "folder") {
        const open = !collapsed.has(node.path);
        return (
          <div key={node.path}>
            <button type="button" onClick={() => toggle(node.path)} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] font-medium text-foreground-2 transition-colors hover:bg-white/5 hover:text-white" style={{ paddingLeft: 8 + depth * 12 }}>
              <CaretDown size={10} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} /> {node.name}
            </button>
            {open ? renderNodes(node.children, depth + 1) : null}
          </div>
        );
      }
      const active = node.path === selectedPath;
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => setSelectedPath(node.path)}
          className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] transition-colors ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <span className={active ? "text-emerald-400" : "text-slate-500 shrink-0"}><FileGlyph path={node.path} /></span>
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="animate-builder-panel flex min-h-0 flex-1">
      {/* Explorer rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#2b2340] bg-[#120e1d] md:flex">
        <p className="border-b border-[#241d36] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Project</p>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">{renderNodes(tree)}</div>
        <p className="border-t border-[#241d36] px-3 py-2 text-[9.5px] leading-relaxed text-slate-600">{files.length} files · regenerated from your last chat edit</p>
      </aside>

      {/* Mobile file picker */}
      <div className="min-w-0 flex-1 md:hidden">
        <select value={activeFile?.path ?? ""} onChange={(e) => setSelectedPath(e.target.value)} className="w-full border-b border-[#2b2340] bg-[#120e1d] px-4 py-2 text-xs text-slate-300 outline-none">
          {files.map((file) => (<option key={file.path} value={file.path}>{file.path}</option>))}
        </select>
        {activeFile ? <EditorBody file={activeFile} /> : null}
      </div>

      {/* Editor */}
      {activeFile ? (
        <div className="hidden min-w-0 flex-1 flex-col bg-[#161126] md:flex">
          <div className="flex items-center justify-between gap-3 border-b border-[#2b2340] px-4 py-2">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
              <span className="shrink-0"><FileGlyph path={activeFile.path} /></span>
              <span className="truncate font-mono">{activeFile.path}</span>
              <span className="ml-2 hidden shrink-0 text-slate-600 lg:inline">{EXT_LANGUAGE[activeFile.language] ?? ""}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={onCopyTraining} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/5 hover:text-white" title={`Copy the training script (${trainingFilename})`}>
                {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />} {copied ? "Copied script" : "Training script"}
              </button>
              <button type="button" onClick={() => onDownloadFile(activeFile)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
                <DownloadSimple size={12} /> Download
              </button>
            </div>
          </div>
          <EditorBody file={activeFile} />
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-[#161126] text-xs text-slate-500 md:flex">No project yet — send a chat message to generate one.</div>
      )}
    </div>
  );
}

function EditorBody({ file }: { file: ScaffoldFile }) {
  const language = PRISM_LANG[file.language] ?? "markup";
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-auto py-4">
      <Highlight theme={NEBULA_THEME} code={file.content.replace(/\n$/, "")} language={language}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre className="min-w-0 px-4 font-mono text-[11.5px] leading-5" style={style}>
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div key={i} {...lineProps} className={`${lineProps.className ?? ""} flex hover:bg-white/[0.03]`}>
                  <span aria-hidden className="w-10 shrink-0 select-none pr-3 text-right text-slate-600">{i + 1}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words">
                    {line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export default AIBuilder;



