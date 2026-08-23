"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowsOutSimple,
  Brain,
  ChartLine,
  CircleNotch,
  Cpu,
  Database,
  Lightning,
  MagnifyingGlass,
  Moon,
  Play,
  Robot,
  SquaresFour,
  Stack,
  Sun,
  Target,
} from "@phosphor-icons/react";
import { useTheme } from "@/components/theme/theme-provider";
import { NODE_PALETTE, CATEGORIES } from "@/lib/canvasConfig";
import { loadProject, type SavedProject } from "@/lib/projectStorage";

type EngineStatus = {
  engine?: string;
  python_version?: string | null;
  machine_check?: string | null;
};

const TEMPLATES = [
  {
    title: "Classic classifier",
    description: "Breast Cancer → Scaler → Random Forest → evaluation charts.",
    icon: Target,
  },
  {
    title: "Fast baseline",
    description: "Iris → Min-Max → KNN with the built-in TypeScript engine.",
    icon: Lightning,
  },
  {
    title: "Deep learning",
    description: "PyTorch MLP pipeline exported as a ready-to-run Colab notebook.",
    icon: Brain,
  },
];

const FEATURES = [
  { icon: SquaresFour, title: "Visual pipelines", description: "Drag nodes, wire the graph, and configure hyperparameters without writing code." },
  { icon: ChartLine, title: "Live dashboards", description: "Accuracy, ROC-AUC, confusion matrices and decision boundaries render as interactive Plotly figures." },
  { icon: Robot, title: "AI builder", description: "Turn a saved model into a polished prediction web app by chatting with the built-in agent." },
  { icon: Database, title: "Your data", description: "Upload CSVs or image folders — target detection and preprocessing are automatic." },
];

function formatSavedAt(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function Dashboard() {
  const { resolvedTheme, toggle } = useTheme();
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [project, setProject] = useState<SavedProject | null>(null);
  const [savedExists, setSavedExists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = loadProject();
      if (cancelled) return;
      setSavedExists(Boolean(saved));
      setProject(saved);
    })();
    fetch("/api/execute")
      .then((res) => res.json())
      .then((data: EngineStatus) => { if (!cancelled) setEngine(data); })
      .catch(() => { if (!cancelled) setEngine({}); });
    return () => { cancelled = true; };
  }, []);

  const datasetCount = NODE_PALETTE.filter((item) => item.category === "data").length;
  const modelCount = NODE_PALETTE.filter((item) => item.category === "classic_ml" || item.category === "deep_learning").length;
  const vizCount = NODE_PALETTE.filter((item) => item.category === "visualization").length;

  const native = engine?.engine === "native-python";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="glass-panel sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <SquaresFour size={20} weight="bold" className="text-foreground" />
            <span className="text-sm font-semibold tracking-tight">NeuralForge</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/canvas" className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground sm:block">Canvas</Link>
            <Link href="/build" className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground sm:block">Build with AI</Link>
            <button type="button" onClick={toggle} aria-label="Toggle theme" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground">
              {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16 sm:pt-20">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-3xl" />
          <p className="animate-slide-up text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Train · evaluate · ship</p>
          <h1 className="animate-slide-up mt-5 max-w-2xl text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl" style={{ animationDelay: "60ms" }}>
            Build machine learning pipelines{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">without code</span>
          </h1>
          <p className="animate-slide-up mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base" style={{ animationDelay: "120ms" }}>
            Wire datasets, preprocessing, and models on a visual canvas. Train instantly, generate real Python for Colab, then let AI wrap your model in a web app.
          </p>
          <div className="animate-slide-up mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
            <Link href="/canvas" className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 shadow-sm transition-all hover:bg-emerald-400 active:scale-[0.98]">
              <Play size={15} weight="fill" /> Open canvas
            </Link>
            <Link href="/build" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold text-foreground-2 transition-all hover:border-border-strong hover:text-foreground active:scale-[0.98]">
              <Robot size={16} /> Build with AI
            </Link>
            {savedExists ? (
              <Link href="/canvas" className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground">
                Resume “{project?.title ?? "saved project"}” <ArrowRight size={12} weight="bold" />
              </Link>
            ) : null}
          </div>

          {/* Engine status strip */}
          <div className="animate-slide-up mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "240ms" }}>
            <StatCard label="Node types" value={String(NODE_PALETTE.length)} detail={`${datasetCount} datasets · ${modelCount} models`} />
            <StatCard label="Chart builders" value={String(vizCount)} detail="Interactive Plotly output" />
            <StatCard label="Categories" value={String(Object.keys(CATEGORIES).length)} detail="Data → deploy-ready" />
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Training engine</p>
              {engine === null ? (
                <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-muted"><CircleNotch size={15} className="animate-spin" /> Detecting…</p>
              ) : native ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-500"><Cpu size={15} weight="fill" /> Python {engine.python_version}</p>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-500"><Lightning size={15} weight="fill" /> Built-in TS engine</p>
              )}
              <p className="mt-0.5 truncate text-[10px] text-muted-2">{engine ? (native ? "Native scikit-learn runtime" : `Machine check: ${engine.machine_check ?? "python unavailable"}`) : "Checking this server…"}</p>
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Start from a template</h2>
              <p className="mt-1 text-xs text-muted">Each opens the canvas pre-seeded with a working pipeline you can edit.</p>
            </div>
            <Link href="/canvas" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-foreground">
              Blank canvas <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {TEMPLATES.map((template) => (
              <Link key={template.title} href="/canvas" className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg">
                <template.icon size={19} className="text-muted-2 transition-colors group-hover:text-foreground" />
                <h3 className="mt-3.5 text-sm font-semibold tracking-tight">{template.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-muted">{template.description}</p>
                <ArrowRight size={14} weight="bold" className="absolute right-4 top-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </section>

        {/* Recent project */}
        {project ? (
          <section className="mt-12">
            <h2 className="text-lg font-bold tracking-tight">Recent project</h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <Stack size={19} className="shrink-0 text-muted-2" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{project.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{project.nodes.length} nodes · {project.edges.length} links · saved {formatSavedAt(project.savedAt)}</p>
                </div>
              </div>
              <Link href="/canvas" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-foreground-2 transition-all hover:border-border-strong hover:text-foreground">
                <ArrowsOutSimple size={13} /> Open in canvas
              </Link>
            </div>
          </section>
        ) : null}

        {/* Features */}
        <section className="mt-14">
          <h2 className="text-lg font-bold tracking-tight">Everything in one studio</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-border-strong">
                <feature.icon size={20} className="text-primary" weight="regular" />
                <h3 className="mt-3 text-sm font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Search hint footer */}
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong px-5 py-4">
          <p className="text-xs text-muted">
            <MagnifyingGlass size={13} weight="bold" className="mr-1 inline text-muted-2" />
            Tip — inside the canvas press <kbd className="rounded border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> to search all {NODE_PALETTE.length} nodes.
          </p>
          <p className="font-mono text-[10px] text-muted-2">NeuralForge · Next.js · FastAPI engine</p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted-2">{detail}</p>
    </div>
  );
}

export default Dashboard;
