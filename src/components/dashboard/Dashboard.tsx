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
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "hover:border-violet-500/30",
    iconColor: "text-violet-500",
  },
  {
    title: "Fast baseline",
    description: "Iris → Min-Max → KNN with the built-in TypeScript engine.",
    icon: Lightning,
    gradient: "from-purple-500/20 to-fuchsia-500/20",
    border: "hover:border-purple-500/30",
    iconColor: "text-purple-500",
  },
  {
    title: "Deep learning",
    description: "PyTorch MLP pipeline exported as a ready-to-run Colab notebook.",
    icon: Brain,
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    border: "hover:border-fuchsia-500/30",
    iconColor: "text-fuchsia-500",
  },
];

const FEATURES = [
  { icon: SquaresFour, title: "Visual pipelines", description: "Drag nodes, wire the graph, and configure hyperparameters without writing code.", color: "text-violet-500", bg: "bg-violet-500/10" },
  { icon: ChartLine, title: "Live dashboards", description: "Accuracy, ROC-AUC, confusion matrices and decision boundaries render as interactive Plotly figures.", color: "text-purple-500", bg: "bg-purple-500/10" },
  { icon: Robot, title: "AI builder", description: "Turn a saved model into a polished prediction web app by chatting with the built-in agent.", color: "text-fuchsia-500", bg: "bg-fuchsia-500/10" },
  { icon: Database, title: "Your data", description: "Upload CSVs or image folders — target detection and preprocessing are automatic.", color: "text-pink-500", bg: "bg-pink-500/10" },
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
            <img src="/logo.png" alt="MLverse" className="-mt-0.5 h-6 w-auto dark:invert" />
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/canvas" className="hidden rounded-xl px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground hover:bg-foreground/[0.04] sm:block">Canvas</Link>
            <Link href="/build" className="hidden rounded-xl px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground hover:bg-foreground/[0.04] sm:block">Build with AI</Link>
            <button type="button" onClick={toggle} aria-label="Toggle theme" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted transition-all hover:border-border-strong hover:text-foreground hover:bg-foreground/[0.04]">
              {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {/* Hero */}
        <section className="relative overflow-hidden pt-20 sm:pt-28">
          {/* Background glow orbs */}
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-violet-500/[0.06] blur-[100px]" />
          <div className="pointer-events-none absolute -top-10 right-0 h-64 w-64 rounded-full bg-purple-500/[0.05] blur-[80px]" />

          <div className="relative">
            <p className="animate-slide-up text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Train · evaluate · ship</p>
            <h1 className="animate-slide-up mt-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl" style={{ animationDelay: "60ms" }}>
              Build machine learning pipelines{" "}
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">without code</span>
            </h1>
            <p className="animate-slide-up mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg" style={{ animationDelay: "120ms" }}>
              Wire datasets, preprocessing, and models on a visual canvas. Train instantly, generate real Python for Colab, then let AI wrap your model in a web app.
            </p>
            <div className="animate-slide-up mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
              <Link href="/canvas" className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 active:scale-[0.97]">
                <Play size={16} weight="fill" /> Open canvas
              </Link>
              <Link href="/build" className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-6 text-sm font-bold text-foreground shadow-sm transition-all hover:border-border-strong hover:shadow-md active:scale-[0.97]">
                <Robot size={17} /> Build with AI
              </Link>
              {savedExists ? (
                <Link href="/canvas" className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground">
                  Resume &quot;{project?.title ?? "saved project"}&quot; <ArrowRight size={12} weight="bold" />
                </Link>
              ) : null}
            </div>
          </div>

          {/* Stats strip */}
          <div className="animate-slide-up mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ animationDelay: "240ms" }}>
            <StatCard label="Node types" value={String(NODE_PALETTE.length)} detail={`${datasetCount} datasets · ${modelCount} models`} />
            <StatCard label="Chart builders" value={String(vizCount)} detail="Interactive Plotly output" />
            <StatCard label="Categories" value={String(Object.keys(CATEGORIES).length)} detail="Data → deploy-ready" />
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border-strong hover:shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Training engine</p>
              {engine === null ? (
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted"><CircleNotch size={15} className="animate-spin" /> Detecting…</p>
              ) : native ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-primary"><Cpu size={15} weight="fill" /> Python {engine.python_version}</p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-amber-500"><Lightning size={15} weight="fill" /> Built-in TS engine</p>
              )}
              <p className="mt-1 truncate text-[10px] text-muted-2">{engine ? (native ? "scikit-learn on this deployment" : `Deployment lacks Python ML stack`) : "Checking this deployment…"}</p>
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="mt-16">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Start from a template</h2>
              <p className="mt-1.5 text-sm text-muted">Each opens the canvas pre-seeded with a working pipeline you can edit.</p>
            </div>
            <Link href="/canvas" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-foreground">
              Blank canvas <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {TEMPLATES.map((template) => (
              <Link key={template.title} href="/canvas" className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${template.border}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${template.gradient}`}>
                    <template.icon size={20} className={template.iconColor} />
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-tight">{template.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{template.description}</p>
                  <ArrowRight size={16} weight="bold" className="absolute right-0 top-0 text-muted opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent project */}
        {project ? (
          <section className="mt-14">
            <h2 className="text-xl font-bold tracking-tight">Recent project</h2>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-border-strong hover:shadow-md">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.05]">
                  <Stack size={19} className="text-muted-2" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{project.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{project.nodes.length} nodes · {project.edges.length} links · saved {formatSavedAt(project.savedAt)}</p>
                </div>
              </div>
              <Link href="/canvas" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-5 text-xs font-bold text-foreground-2 shadow-sm transition-all hover:border-border-strong hover:shadow-md">
                <ArrowsOutSimple size={13} /> Open in canvas
              </Link>
            </div>
          </section>
        ) : null}

        {/* Features */}
        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">Everything in one studio</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-border-strong hover:shadow-lg hover:-translate-y-0.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.bg}`}>
                  <feature.icon size={20} className={feature.color} weight="regular" />
                </div>
                <h3 className="mt-4 text-sm font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer tip */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-5">
          <p className="text-sm text-muted">
            <MagnifyingGlass size={14} weight="bold" className="mr-1 inline text-muted-2" />
            Tip — inside the canvas press <kbd className="rounded-lg border border-border bg-foreground/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold">⌘K</kbd> to search all {NODE_PALETTE.length} nodes.
          </p>
          <p className="font-mono text-[10px] text-muted-2">MLverse · Next.js · FastAPI engine</p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border-strong hover:shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 truncate text-[10px] text-muted-2">{detail}</p>
    </div>
  );
}

export default Dashboard;
