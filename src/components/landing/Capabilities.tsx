"use client";

import { useEffect, useState } from "react";
import {
  GraphIcon,
  Robot,
  Lightning,
  ChartLineUp,
  Broom,
  Code,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

/* ── Mini illustration: node graph ─────────────────────────────────── */
function CanvasIllustration() {
  return (
    <svg viewBox="0 0 420 190" className="h-full w-full text-neutral-900 dark:text-white" aria-hidden="true">
      {/* edges */}
      <path d="M78 52 C 140 52, 150 95, 210 95" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" className="nf-edge-flow" />
      <path d="M78 138 C 140 138, 150 95, 210 95" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <path d="M296 95 C 340 95, 344 60, 366 60" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <path d="M296 95 C 340 95, 344 130, 366 130" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" className="nf-edge-flow" style={{ animationDelay: "0.9s" }} />
      {/* input nodes */}
      {[
        { x: 40, y: 38, label: "CSV", w: 76 },
        { x: 40, y: 124, label: "API", w: 76 },
      ].map((n) => (
        <g key={n.label}>
          <rect x={n.x} y={n.y} width={n.w} height={28} rx={7} className="fill-neutral-50 stroke-neutral-300 dark:fill-white/[0.04] dark:stroke-white/15" />
          <circle cx={n.x + 14} cy={n.y + 14} r={3} className="fill-neutral-900 dark:fill-white" />
          <text x={n.x + 26} y={n.y + 18} fontSize="10" className="fill-neutral-500 dark:fill-zinc-400" fontFamily="monospace">{n.label}</text>
        </g>
      ))}
      {/* core model node */}
      <rect x="210" y="72" width="86" height="46" rx="9" className="fill-neutral-100 stroke-neutral-900 dark:fill-white/[0.08] dark:stroke-white/60" strokeWidth="1.2" />
      <text x="228" y="93" fontSize="10" className="fill-neutral-900 dark:fill-zinc-100" fontFamily="monospace">XGBoost</text>
      <text x="228" y="107" fontSize="8.5" className="fill-neutral-500 dark:fill-zinc-400" fontFamily="monospace">classifier</text>
      {/* outputs */}
      {[
        { y: 46, label: "metrics" },
        { y: 116, label: "predict" },
      ].map((n) => (
        <g key={n.label}>
          <rect x="366" y={n.y} width="44" height="28" rx={7} className="fill-neutral-50 stroke-neutral-300 dark:fill-white/[0.04] dark:stroke-white/15" />
          <text x="374" y={n.y + 17} fontSize="8" className="fill-neutral-500 dark:fill-zinc-400" fontFamily="monospace">{n.label}</text>
        </g>
      ))}
      {/* traveling packet */}
      <circle r="2.5" className="fill-neutral-900 dark:fill-white">
        <animateMotion dur="2.4s" repeatCount="indefinite" path="M78 52 C 140 52, 150 95, 210 95" />
      </circle>
      <circle r="2.5" className="fill-neutral-900 opacity-85 dark:fill-white" opacity="0.85">
        <animateMotion dur="2.4s" begin="1.2s" repeatCount="indefinite" path="M296 95 C 340 95, 344 130, 366 130" />
      </circle>
    </svg>
  );
}

/* ── Mini illustration: AI prompt typing ───────────────────────────── */
const PROMPTS = [
  "Predict churn on customers.csv…",
  "Forecast next 30 days of sales…",
  "Classify sentiment of reviews…",
];

function AIIllustration() {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold">("typing");

  useEffect(() => {
    const full = PROMPTS[idx];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (chars < full.length) {
        t = setTimeout(() => setChars((c) => c + 1), 42);
      } else {
        t = setTimeout(() => setPhase("hold"), 1600);
      }
    } else {
      t = setTimeout(() => {
        setIdx((i) => (i + 1) % PROMPTS.length);
        setChars(0);
        setPhase("typing");
      }, 300);
    }
    return () => clearTimeout(t);
  }, [chars, phase, idx]);

  return (
    <div className="flex h-full flex-col justify-center gap-2 font-mono text-[11px]">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-neutral-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
        <Robot size={13} className="shrink-0 text-neutral-900 dark:text-zinc-300" weight="fill" />
        <span className="truncate">
          {PROMPTS[idx].slice(0, chars)}
          <span className="nf-caret ml-0.5 inline-block h-3 w-[6px] translate-y-[2px] bg-neutral-900 dark:bg-white" />
        </span>
      </div>
      <div className="ml-6 flex items-center gap-2 self-start rounded-lg rounded-tl-none border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
        building pipeline · 12 nodes
      </div>
    </div>
  );
}

/* ── Mini illustration: engine toggle ──────────────────────────────── */
function EngineIllustration() {
  const [gpu, setGpu] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setGpu((v) => !v), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full items-center gap-2 font-mono text-[11px]">
      <span className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition-all duration-500 ${
        !gpu
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-400 dark:border-white/10 dark:text-zinc-600"
      }`}>
        CPU · instant
      </span>
      <Lightning size={13} className={gpu ? "text-neutral-900 dark:text-white" : "text-neutral-300 dark:text-zinc-700"} weight="fill" />
      <span className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition-all duration-500 ${
        gpu
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-400 dark:border-white/10 dark:text-zinc-600"
      }`}>
        Colab GPU
      </span>
    </div>
  );
}

/* ── Mini illustration: sparkline ──────────────────────────────────── */
function ChartIllustration() {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <svg viewBox="0 0 200 64" className="w-full" aria-hidden="true">
        <polyline
          points="0,52 20,48 40,50 60,40 80,42 100,32 120,34 140,22 160,26 180,12 200,16"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="400"
          strokeDashoffset="400"
          className="nf-draw-line stroke-neutral-900 dark:stroke-white"
        />
        <polyline
          points="0,58 20,56 40,57 60,52 80,54 100,48 120,49 140,44 160,45 180,40 200,41"
          fill="none"
          strokeWidth="1.5"
          className="stroke-neutral-300 dark:stroke-white/25"
        />
      </svg>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">
        <span>epoch loss</span>
        <span className="text-emerald-600 dark:text-emerald-400">+18.4% acc</span>
      </div>
    </div>
  );
}

/* ── Mini illustration: cleaning rows ──────────────────────────────── */
function CleanIllustration() {
  const rows = [
    ["age", "27", true],
    ["income", "null → 42k", false],
    ["region", "EU-WEST", true],
    ["score", "NaN → 0.82", false],
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 font-mono text-[10px]">
      {rows.map(([k, v], i) => (
        <div key={k} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
          <span className="text-neutral-400 dark:text-zinc-500">{k}</span>
          <span className={v ? "text-neutral-700 dark:text-zinc-300" : "text-emerald-600 dark:text-emerald-300"}>{v}</span>
        </div>
      ))}
      <div className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">
        <Broom size={10} className="text-neutral-700 dark:text-zinc-300" />
        auto-imputed 2 fields
      </div>
    </div>
  );
}

/* ── Mini illustration: code window ────────────────────────────────── */
function CodeIllustration() {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 p-3 font-mono text-[10px] leading-relaxed dark:border-white/[0.08] dark:bg-black/60">
      <pre className="whitespace-pre-wrap text-neutral-400">
        <span className="font-semibold text-neutral-100">import</span> xgboost <span className="font-semibold text-neutral-100">as</span> xgb{"\n"}
        <span className="font-semibold text-neutral-100">from</span> sklearn.model_selection <span className="font-semibold text-neutral-100">import</span> split{"\n"}
        {"\n"}
        model = xgb.<span className="text-neutral-200">XGBClassifier</span>({"\n"}
        {"  "}n_estimators=<span className="text-neutral-300">800</span>,{"\n"}
        {"  "}max_depth=<span className="text-neutral-300">6</span>,{"\n"}
        {")"}
      </pre>
    </div>
  );
}

/* ── Card shell ────────────────────────────────────────────────────── */
interface CardProps {
  icon: typeof GraphIcon;
  title: string;
  copy: string;
  children?: React.ReactNode;
  className?: string;
  index: string;
}

function Card({ icon: Icon, title, copy, children, className = "", index }: CardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-500 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)] dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/25 dark:hover:bg-white/[0.03] dark:hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] nf-hud-corners ${className}`}
    >
      <div className="mb-5 flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 transition-all duration-500 group-hover:border-neutral-900 group-hover:text-neutral-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:group-hover:border-white/40 dark:group-hover:text-white">
          <Icon size={19} weight="duotone" />
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-300 transition-colors duration-500 group-hover:text-neutral-600 dark:text-zinc-700 dark:group-hover:text-zinc-400">
          {index}
        </span>
      </div>
      <h3 className="text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-zinc-500">{copy}</p>
      {children ? (
        <div className="mt-6 min-h-[104px] rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 dark:border-white/[0.05] dark:bg-black/30">{children}</div>
      ) : null}
    </div>
  );
}

export function Capabilities() {
  return (
    <section id="capabilities" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      <SectionHead
        index="01"
        kicker="Capabilities"
        title={
          <>
            Everything a data team needs.
            <br />
            <span className="text-neutral-400 dark:text-zinc-500">Nothing it doesn&apos;t.</span>
          </>
        }
        copy="A complete machine-learning workbench in the browser — from raw CSV to production endpoint, without writing a single line unless you want to."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card
            index="/ 01"
            icon={GraphIcon}
            title="Visual pipeline canvas"
            copy="Compose data sources, transforms and models on an infinite canvas. Every connection is validated live — impossible pipelines simply can't be wired."
            className="h-full"
          >
            <CanvasIllustration />
          </Card>
        </Reveal>

        <Reveal delay={100}>
          <Card
            index="/ 02"
            icon={Robot}
            title="Describe it, AI builds it"
            copy="Type what you want predicted. The AI Builder drafts the whole graph — features, model, validation — ready for you to tweak."
          >
            <AIIllustration />
          </Card>
        </Reveal>

        <Reveal delay={80}>
          <Card
            index="/ 03"
            icon={Lightning}
            title="Hybrid execution engine"
            copy="Small datasets train instantly in-browser on CPU. Heavy lifting scales out to Colab GPUs automatically — one toggle, zero config."
          >
            <EngineIllustration />
          </Card>
        </Reveal>

        <Reveal delay={140}>
          <Card
            index="/ 04"
            icon={ChartLineUp}
            title="Dashboards that build themselves"
            copy="Every run generates interactive Plotly analytics — loss curves, confusion matrices, feature importance — exportable in one click."
          >
            <ChartIllustration />
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <Card
            index="/ 05"
            icon={Code}
            title="Own your code"
            copy="Export clean, idiomatic Python at any time. Your canvas is never a black box — take the notebook, run it anywhere."
          >
            <CodeIllustration />
          </Card>
        </Reveal>

        <Reveal delay={240}>
          <Card
            index="/ 06"
            icon={Broom}
            title="One-click data hygiene"
            copy="Nulls, outliers, encoding, scaling — detected and fixed with transparent suggestions before they poison your model."
          >
            <CleanIllustration />
          </Card>
        </Reveal>
      </div>

      <Reveal delay={150}>
        <div className="mt-12 flex justify-center">
          <a
            href="#training-demo"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white"
          >
            See it train a real model
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
