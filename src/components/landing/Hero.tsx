"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Database,
  Faders,
  Brain,
  ChartLineUp,
  Sparkle,
  Play,
} from "@phosphor-icons/react";

function CountUp({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1400);
        setVal(to * (1 - Math.pow(1 - progress, 4)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}

const pipeline = [
  { icon: Database, label: "customers.csv", meta: "24.8k rows", tone: "sky" },
  { icon: Faders, label: "Clean data", meta: "6 transforms", tone: "violet" },
  { icon: Brain, label: "XGBoost", meta: "training", tone: "amber" },
  { icon: ChartLineUp, label: "Evaluate", meta: "94.8% accuracy", tone: "emerald" },
] as const;

function ProductPreview() {
  return (
    <div className="nf-product-preview relative mx-auto w-full max-w-[660px] lg:mr-0">
      <div className="absolute -inset-12 -z-10 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10" />
      <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/85 shadow-[0_32px_90px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0e14]/90 dark:shadow-[0_35px_100px_-25px_rgba(0,0,0,0.8)]">
        <div className="flex h-12 items-center justify-between border-b border-slate-200/80 px-4 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">Customer churn · Pipeline</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </div>
        </div>

        <div className="relative min-h-[390px] overflow-hidden bg-[#f8fafc] p-5 sm:p-8 dark:bg-[#080b10]">
          <div className="nf-preview-grid pointer-events-none absolute inset-0" />
          <div className="relative grid gap-4 sm:grid-cols-2">
            {pipeline.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className={`nf-pipeline-node nf-node-${step.tone} relative rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#111620] ${index > 1 ? "sm:ml-8" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="nf-node-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <Icon size={19} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-100">{step.label}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">{step.meta}</p>
                    </div>
                    {index === 2 && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                    {index === 3 && <CheckCircle className="ml-auto text-emerald-500" size={17} weight="fill" />}
                  </div>
                  {index < 3 && <span className="nf-pipeline-wire" aria-hidden="true" />}
                </div>
              );
            })}
          </div>

          <div className="relative mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111620]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-100">Validation accuracy</p>
                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-widest text-slate-400">50 epochs · auto-tuned</p>
              </div>
              <span className="text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">94.8%</span>
            </div>
            <svg viewBox="0 0 520 62" className="h-14 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0ea5e9" stopOpacity=".24" />
                  <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 54 C55 50 70 45 112 42 S172 37 210 31 S274 35 312 24 S365 25 407 15 S470 13 520 5 L520 62 L0 62Z" fill="url(#chart-fill)" />
              <path d="M0 54 C55 50 70 45 112 42 S172 37 210 31 S274 35 312 24 S365 25 407 15 S470 13 520 5" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" className="nf-chart-path" />
            </svg>
          </div>
        </div>
      </div>

      <div className="nf-floating-card absolute -bottom-6 -left-3 hidden items-center gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 pr-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#111620]/90 sm:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300">
          <Sparkle size={17} weight="fill" />
        </div>
        <div><p className="text-[10px] font-semibold text-slate-800 dark:text-zinc-100">Auto-optimized</p><p className="text-[9px] text-slate-400">12 parameters tuned</p></div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#f8fafc] pt-20 dark:bg-[#05070a]">
      <div className="nf-hero-mesh pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-[8%] top-28 -z-10 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-600/10" />
      <div className="pointer-events-none absolute right-[4%] top-20 -z-10 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />

      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:py-20 xl:px-14">
        <div className="relative z-10 max-w-xl">
          <div className="nf-fade-up inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-sky-800 shadow-sm backdrop-blur dark:border-sky-400/20 dark:bg-sky-400/[0.07] dark:text-sky-300">
            <Sparkle size={13} weight="fill" />
            The visual workspace for applied AI
            <ArrowRight size={12} weight="bold" />
          </div>

          <h1 className="mt-7 text-balance text-[46px] font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl lg:text-[68px] xl:text-[76px]">
            <span className="nf-hero-line block">From raw data</span>
            <span className="nf-hero-line nf-gradient-text mt-1 block [animation-delay:100ms]">to real intelligence.</span>
          </h1>

          <p className="nf-fade-up mt-7 max-w-lg text-pretty text-base leading-7 text-slate-600 [animation-delay:260ms] dark:text-zinc-400 sm:text-lg">
            Build production-ready machine learning pipelines on a visual canvas. Clean data, train models, and ship predictions — without wrestling with code.
          </p>

          <div className="nf-fade-up mt-9 flex flex-col gap-3 [animation-delay:400ms] sm:flex-row">
            <Link href="/canvas" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_rgba(2,132,199,.65)] transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-[0_16px_36px_-10px_rgba(2,132,199,.8)] active:translate-y-0 dark:bg-white dark:text-slate-950 dark:hover:bg-sky-300">
              Start building free
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#training-demo" className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white/70 px-6 text-sm font-semibold text-slate-700 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300"><Play size={10} weight="fill" /></span>
              See it in action
            </a>
          </div>

          <div className="nf-fade-up mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200/80 pt-6 [animation-delay:540ms] dark:border-white/[0.08]">
            {[
              [128, "k+", "models trained"],
              [94, " sec", "to first model"],
              [99.9, "%", "uptime"],
            ].map(([value, suffix, label], i) => (
              <div key={String(label)} className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white"><CountUp to={Number(value)} suffix={String(suffix)} decimals={i === 2 ? 1 : 0} /></span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="nf-fade-up relative z-10 [animation-delay:320ms]">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
