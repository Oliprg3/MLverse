"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  CircleNotch,
  CheckCircle,
  Database,
  Broom,
  GraphIcon,
  Cpu,
  ChartLineUp,
  RocketLaunch,
  Warning,
} from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

/* ════════════════════════════════════════════════════════════════════
   Chapter timeline model
   ════════════════════════════════════════════════════════════════════ */
const CHAPTERS = [
  { id: "import", label: "Import data", icon: Database, ms: 4600 },
  { id: "clean", label: "Clean", icon: Broom, ms: 4600 },
  { id: "model", label: "Pick model", icon: GraphIcon, ms: 5400 },
  { id: "train", label: "Train", icon: Cpu, ms: 8200 },
  { id: "evaluate", label: "Evaluate", icon: ChartLineUp, ms: 5600 },
  { id: "deploy", label: "Deploy", icon: RocketLaunch, ms: 5000 },
] as const;

const TOTAL_MS = CHAPTERS.reduce((a, c) => a + c.ms, 0);
const STARTS = CHAPTERS.reduce<number[]>((acc, c, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + CHAPTERS[i - 1].ms);
  return acc;
}, []);

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ════════════════════════════════════════════════════════════════════
   Scene 01 — Import
   ════════════════════════════════════════════════════════════════════ */
const CSV_ROWS = [
  ["#1042", "27", "42,300", "EU-WEST", "churn"],
  ["#1043", "34", "58,120", "US-EAST", "retain"],
  ["#1044", "41", "39,990", "APAC", "churn"],
  ["#1045", "23", "21,450", "EU-NORTH", "churn"],
  ["#1046", "38", "77,310", "US-WEST", "retain"],
];

function ImportScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="nf-scene-item flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-white/[0.03]">
        <Database size={18} className="text-neutral-900 dark:text-zinc-200" />
        <span className="font-mono text-xs text-neutral-700 dark:text-zinc-300">customers_churn.csv</span>
        <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white dark:bg-white/10 dark:text-emerald-300">uploaded</span>
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 dark:border-white/[0.08]">
        <div className="grid grid-cols-5 gap-px bg-neutral-200 font-mono text-[9px] uppercase tracking-wider text-neutral-500 dark:bg-white/[0.06] dark:text-zinc-600">
          {["id", "age", "income", "region", "label"].map((h, i) => (
            <span key={h} className="nf-scene-item bg-neutral-100 px-3 py-2 dark:bg-[#0b0b0f]" style={{ animationDelay: `${200 + i * 110}ms` }}>
              {h}
            </span>
          ))}
          {CSV_ROWS.flatMap((row, ri) =>
            row.map((cell, ci) => (
              <span
                key={`${ri}-${ci}`}
                className={`nf-scene-item bg-white px-3 py-1.5 text-[10px] text-neutral-500 odd:bg-neutral-50 dark:bg-[#0d0d12] dark:text-zinc-400 dark:odd:bg-[#0a0a0e] ${ci === 4 ? "!text-neutral-900 dark:!text-zinc-200" : ""}`}
                style={{ animationDelay: `${650 + (ri * 5 + ci) * 55}ms` }}
              >
                {cell}
              </span>
            ))
          )}
        </div>
      </div>
      <p className="nf-scene-item font-mono text-[11px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "2100ms" }}>
        schema inferred · <span className="text-neutral-800 dark:text-zinc-300">1,204 rows</span> ·{" "}
        <span className="text-neutral-900 font-medium dark:text-white">9 features</span> detected
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Scene 02 — Clean
   ════════════════════════════════════════════════════════════════════ */
function CleanScene() {
  const fixes = [
    { cell: "income = null", fix: "imputed → 47,850", delay: 900 },
    { cell: "age = NaN", fix: "median → 33", delay: 1900 },
    { cell: "region = ??", fix: "mode → EU-WEST", delay: 2900 },
  ];
  return (
    <div className="flex h-full w-full flex-col justify-center gap-4">
      <div className="mx-auto w-full max-w-md space-y-2 font-mono text-[11px]">
        {fixes.map((f) => (
          <div key={f.cell} className="nf-clean-row relative overflow-hidden rounded-lg border border-neutral-200 bg-white px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <span className="flex items-center gap-2 text-red-600 dark:text-red-400/90">
              <Warning size={12} weight="fill" />
              {f.cell}
            </span>
            <span
              className="nf-fix-swap absolute inset-0 flex items-center gap-2 bg-white px-4 text-emerald-700 dark:bg-[#071009]/95 dark:text-emerald-300"
              style={{ animationDelay: `${f.delay}ms` }}
            >
              <CheckCircle size={12} weight="fill" />
              {f.fix}
            </span>
          </div>
        ))}
      </div>
      <p className="nf-scene-item self-center font-mono text-[11px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "3600ms" }}>
        outliers capped · encodings applied · <span className="text-emerald-600 dark:text-emerald-300">dataset ready</span>
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Scene 03 — Model graph
   ════════════════════════════════════════════════════════════════════ */
function ModelScene() {
  const nodes = [
    { x: 30, y: 76, w: 84, label: "features", hot: false },
    { x: 168, y: 30, w: 92, label: "scaler", hot: false },
    { x: 168, y: 122, w: 92, label: "encoder", hot: false },
    { x: 316, y: 76, w: 96, label: "XGBoost", hot: true },
  ];
  const edges = ["M114 90 L168 44", "M114 90 L168 136", "M260 44 L316 88", "M260 136 L316 92"];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <svg viewBox="0 0 440 170" className="w-full max-w-lg text-neutral-900 dark:text-white" aria-hidden="true">
        {edges.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" className="nf-edge-draw" style={{ animationDelay: `${1400 + i * 350}ms` }} />
            <circle r="2.5" className="fill-neutral-900 opacity-0 dark:fill-white">
              <animateMotion dur="1.6s" begin={`${2600 + i * 250}ms`} repeatCount="3" path={d} />
            </circle>
          </g>
        ))}
        {nodes.map((n, i) => (
          <g key={n.label} className="nf-node-pop" style={{ animationDelay: `${250 + i * 330}ms`, transformOrigin: `${n.x + n.w / 2}px ${n.y + 20}px` }}>
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={40}
              rx={9}
              className={n.hot
                ? "fill-neutral-100 stroke-neutral-900 dark:fill-white/[0.1] dark:stroke-white/70"
                : "fill-neutral-50 stroke-neutral-300 dark:fill-white/[0.04] dark:stroke-white/15"}
            />
            <circle cx={n.x + 16} cy={n.y + 20} r={3.5} className={n.hot ? "fill-neutral-900 dark:fill-white" : "fill-neutral-400 dark:fill-white/35"} />
            <text x={n.x + 28} y={n.y + 24} fontSize="11" fontFamily="monospace" className={n.hot ? "fill-neutral-900 dark:fill-zinc-100" : "fill-neutral-500 dark:fill-zinc-400"}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="nf-scene-item font-mono text-[11px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "3200ms" }}>
        gradient boosting selected · <span className="text-neutral-900 font-medium dark:text-white">80 / 20 split</span> locked
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Scene 04 — Train (driven by progress 0..1)
   ════════════════════════════════════════════════════════════════════ */
function TrainScene({ progress }: { progress: number }) {
  const EPOCHS = 24;
  const epoch = Math.min(EPOCHS, Math.max(1, Math.ceil(progress * EPOCHS)));
  const loss = 0.72 * Math.exp(-2.6 * progress) + 0.031;
  const acc = 51.2 + 43 * (1 - Math.exp(-3.2 * progress));

  const pts = useMemo(() => {
    const N = 48;
    const arr: string[] = [];
    for (let i = 0; i <= Math.floor(progress * N); i++) {
      const x = (i / N) * 100;
      const y = 6 + 52 * Math.exp(-(i / N) * 3.1) + Math.sin(i * 1.7) * 1.6;
      arr.push(`${x},${y.toFixed(2)}`);
    }
    return arr.join(" ");
  }, [progress]);

  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-5 md:grid-cols-[1fr_240px]">
      {/* loss chart */}
      <div className="relative h-full min-h-[130px] rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/[0.07] dark:bg-black/40">
        <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">
          <span>training loss</span>
          <span className="text-neutral-700 dark:text-zinc-300">run #A41F</span>
        </div>
        <svg viewBox="0 0 100 64" preserveAspectRatio="none" className="h-[calc(100%-22px)] w-full" aria-hidden="true">
          {[16, 32, 48].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} className="stroke-neutral-200 dark:stroke-white/10" strokeWidth="0.4" />
          ))}
          <polyline points={pts || "0,58"} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-neutral-900 dark:stroke-white" />
          {pts && (
            <circle
              cx={100}
              cy={6 + 52 * Math.exp(-progress * 3.1) + Math.sin(Math.floor(progress * 48) * 1.7) * 1.6}
              r="2"
              className="fill-neutral-900 dark:fill-white nf-glow-dot"
            />
          )}
        </svg>
      </div>
      {/* live readouts */}
      <div className="space-y-2.5 font-mono text-xs">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">epoch</div>
          <div className="mt-0.5 text-xl font-semibold text-neutral-900 dark:text-white">
            {String(epoch).padStart(2, "0")}
            <span className="text-sm text-neutral-400 dark:text-zinc-600">/{EPOCHS}</span>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">loss</div>
          <div className="mt-0.5 text-xl font-semibold text-neutral-900 dark:text-zinc-100">{loss.toFixed(3)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">val accuracy</div>
          <div className="mt-0.5 text-xl font-semibold text-emerald-600 dark:text-emerald-300">{acc.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Scene 05 — Evaluate
   ════════════════════════════════════════════════════════════════════ */
function EvaluateScene() {
  const metrics = [
    { k: "Accuracy", v: "94.2%", c: "text-emerald-600 dark:text-emerald-300" },
    { k: "F1 score", v: "0.931", c: "text-neutral-900 dark:text-white" },
    { k: "ROC-AUC", v: "0.974", c: "text-neutral-900 dark:text-zinc-200" },
  ];
  // confusion matrix values (2x2)
  const cm = [86, 9, 4, 101];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex w-full max-w-md justify-between gap-3">
        {metrics.map((m, i) => (
          <div key={m.k} className="nf-metric-pop flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center dark:border-white/[0.08] dark:bg-white/[0.02]" style={{ animationDelay: `${300 + i * 400}ms` }}>
            <div className={`font-mono text-2xl font-semibold ${m.c}`}>{m.v}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">{m.k}</div>
          </div>
        ))}
      </div>
      <div className="nf-scene-item flex items-center gap-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/[0.07] dark:bg-black/40" style={{ animationDelay: "1500ms" }}>
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">confusion matrix</div>
          <div className="grid grid-cols-2 gap-1">
            {cm.map((v, i) => (
              <span
                key={i}
                className={`nf-cm-cell flex h-11 w-11 items-center justify-center rounded font-mono text-xs ${
                  i === 0 || i === 3
                    ? "bg-neutral-900 text-white dark:bg-white/90 dark:text-neutral-900"
                    : "bg-neutral-200/70 text-neutral-400 dark:bg-white/[0.05] dark:text-zinc-500"
                }`}
                style={{ animationDelay: `${1800 + i * 220}ms` }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 font-mono text-[10px] leading-relaxed text-neutral-500 dark:text-zinc-500">
          <p><span className="text-emerald-600 dark:text-emerald-300">TP 86</span> — churners caught</p>
          <p><span className="text-neutral-800 dark:text-zinc-300">TN 101</span> — safe kept safe</p>
          <p><span className="text-neutral-400 dark:text-zinc-500">FP 9 · FN 4</span></p>
          <p className="pt-1 text-neutral-600 dark:text-zinc-400">feature importance exported → dashboard</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Scene 06 — Deploy (driven by progress)
   ════════════════════════════════════════════════════════════════════ */
function DeployScene({ progress }: { progress: number }) {
  const cmd = "$ nf deploy --target production";
  const url = "https://api.mlverse.app/v1/models/churn-predictor";
  const cmdChars = Math.floor(Math.min(1, progress / 0.45) * cmd.length);
  const urlChars = Math.floor(Math.max(0, (progress - 0.55) / 0.45) * url.length);
  const live = progress > 0.62;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-400 dark:text-zinc-500">
        {live ? "Model live" : "Shipping…"}
      </div>
      <div className="w-full max-w-md rounded-xl border border-neutral-900 bg-neutral-900 p-4 font-mono text-xs dark:border-white/[0.08] dark:bg-black/70">
        <p className="text-neutral-100">
          {cmd.slice(0, cmdChars)}
          <span className="nf-caret ml-0.5 inline-block h-3 w-[6px] translate-y-[2px] bg-white" />
        </p>
        {urlChars > 0 && (
          <p className="mt-2 break-all text-emerald-300/90">↳ endpoint {url.slice(0, urlChars)}</p>
        )}
        {live && (
          <p className="mt-2 text-neutral-400 dark:text-zinc-500">
            cold start <span className="text-neutral-100 dark:text-zinc-300">380ms</span> · autoscaling <span className="text-neutral-100 dark:text-zinc-300">on</span> · region{" "}
            <span className="text-neutral-100 dark:text-zinc-300">eu-central</span>
          </p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   The player
   ════════════════════════════════════════════════════════════════════ */
export function TrainingShowcase() {
  const [chapter, setChapter] = useState(0);
  const [t, setT] = useState(0); // ms into current chapter
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Autostart once visible
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Playback clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((prev) => {
        const dur = CHAPTERS[chapter].ms;
        if (prev + dt >= dur) {
          setChapter((c) => (c + 1) % CHAPTERS.length);
          return 0;
        }
        return prev + dt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, chapter]);

  const seek = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      let global = frac * TOTAL_MS;
      let ci = 0;
      for (let i = 0; i < STARTS.length; i++) {
        if (global >= STARTS[i]) ci = i;
      }
      setChapter(ci);
      setT(global - STARTS[ci]);
    },
    []
  );

  const elapsedGlobal = STARTS[chapter] + t;
  const progress = t / CHAPTERS[chapter].ms;
  const ActiveIcon = CHAPTERS[chapter].icon;

  return (
    <section id="training-demo" className="relative scroll-mt-24 py-28 sm:py-36">
      {/* backdrop accents */}
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-neutral-200/50 blur-[120px] dark:bg-white/[0.025]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="02"
          kicker="Live walkthrough"
          title={
            <>
              Watch a model get trained.{" "}
              <span className="text-neutral-400 dark:text-zinc-500">Start to finish.</span>
            </>
          }
          copy="This is not a recorded video — it's the actual pipeline flow, replayed live in your browser. Six chapters, one click to scrub, exactly how you'll do it inside MLverse."
        />

        <Reveal>
          <div ref={rootRef} className="relative mx-auto max-w-5xl">
            {/* outer HUD brackets */}
            <span className="pointer-events-none absolute -left-3 -top-3 hidden h-8 w-8 border-l border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -right-3 -top-3 hidden h-8 w-8 border-r border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -left-3 hidden h-8 w-8 border-b border-l border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -right-3 hidden h-8 w-8 border-b border-r border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_60px_120px_-60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#070709] dark:shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
              {/* Title bar */}
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-neutral-400 dark:text-zinc-500">how-to-train-your-first-model.nf</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-zinc-400">
                    auto demo
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-neutral-400 dark:text-zinc-500">
                    {fmt(elapsedGlobal)} <span className="text-neutral-300 dark:text-zinc-700">/ {fmt(TOTAL_MS)}</span>
                  </span>
                </div>
              </div>

              {/* Stage */}
              <div className="relative h-[380px] overflow-hidden sm:h-[420px]" key={chapter}>
                <div className="absolute inset-0 nf-grid-bg opacity-40" aria-hidden="true" />
                <div className="absolute inset-0 p-6 sm:p-8">
                  {CHAPTERS[chapter].id === "import" && <ImportScene />}
                  {CHAPTERS[chapter].id === "clean" && <CleanScene />}
                  {CHAPTERS[chapter].id === "model" && <ModelScene />}
                  {CHAPTERS[chapter].id === "train" && <TrainScene progress={progress} />}
                  {CHAPTERS[chapter].id === "evaluate" && <EvaluateScene />}
                  {CHAPTERS[chapter].id === "deploy" && <DeployScene progress={progress} />}
                </div>
                {/* scanline sweep */}
                <div className="nf-scan pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-neutral-400/10 to-transparent dark:via-white/[0.05]" aria-hidden="true" />
              </div>

              {/* Controls */}
              <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3.5 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-5">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setPlaying((v) => !v)}
                    aria-label={playing ? "Pause demo" : "Play demo"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-all hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    {playing ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" className="translate-x-[1px]" />}
                  </button>

                  {/* Scrub track */}
                  <div
                    ref={trackRef}
                    onClick={(e) => seek(e.clientX)}
                    className="group relative h-6 flex-1 cursor-pointer"
                    role="slider"
                    aria-label="Seek demo"
                    aria-valuemin={0}
                    aria-valuemax={TOTAL_MS}
                    aria-valuenow={Math.round(elapsedGlobal)}
                    tabIndex={0}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-white/[0.08]">
                      {STARTS.slice(1).map((s) => (
                        <span
                          key={s}
                          className="absolute top-0 h-full w-px bg-neutral-400 dark:bg-white/25"
                          style={{ left: `${(s / TOTAL_MS) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div
                      className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-neutral-900 dark:bg-white"
                      style={{ width: `${(elapsedGlobal / TOTAL_MS) * 100}%` }}
                    />
                  </div>

                  <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400 dark:text-zinc-500 sm:flex">
                    <ActiveIcon size={13} className="text-neutral-800 dark:text-zinc-200" />
                    CH {String(chapter + 1).padStart(2, "0")}/{String(CHAPTERS.length).padStart(2, "0")}
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter chips */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {CHAPTERS.map((c, i) => {
                const Icon = c.icon;
                const done = i < chapter;
                const active = i === chapter;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChapter(i);
                      setT(0);
                      setPlaying(true);
                    }}
                    className={`inline-flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-300 ${
                      active
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : done
                          ? "border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-500"
                          : "border-neutral-200 bg-transparent text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 dark:border-white/10 dark:text-zinc-600 dark:hover:border-white/25 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Icon size={12} className={active ? "" : ""} />
                    {String(i + 1).padStart(2, "0")} {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
