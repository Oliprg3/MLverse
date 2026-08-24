"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, CaretDown } from "@phosphor-icons/react";
import { ParticleField } from "./ParticleField";

const HERO_VIDEO = "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4";
const HERO_VIDEO_FALLBACK = "https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4";

function CountUp({ to, suffix = "", prefix = "", decimals = 0 }: { to: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const dur = 1800;
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(2, -10 * p);
            setVal(to * (p === 1 ? 1 : eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-white dark:bg-[#030304]">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl nf-aurora dark:bg-violet-500/10" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl nf-aurora [animation-delay:-5s] dark:bg-emerald-400/10" />

      {/* Layer 1 — procedural particle network */}
      <div className="absolute inset-0 opacity-70">
        <ParticleField className="h-full w-full" />
      </div>

      {/* Layer 2 — background video (dark mode only) */}
      <video
        className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover opacity-25 mix-blend-screen dark:block"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
        <source src={HERO_VIDEO_FALLBACK} type="video/mp4" />
      </video>

      {/* Layer 3 — cinematic overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-white dark:from-[#030304]/70 dark:to-[#050506]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent dark:from-[#050506]" />

      {/* HUD grid lines */}
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-36 text-center sm:px-8">
        <div className="nf-fade-up mb-7 inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white/60 py-1.5 pl-2 pr-4 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03]">
          <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white dark:bg-white dark:text-neutral-900">
            New
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500 dark:text-zinc-400">
            v3 · Hybrid GPU engine is live
          </span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
        </div>

        <h1 className="max-w-5xl text-balance text-[42px] font-semibold leading-[1.04] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-6xl md:text-7xl lg:text-[84px]">
          {"Train AI models at the|speed of thought.".split("|").map((line, li) => (
            <span key={li} className="block overflow-hidden pb-1">
              <span className={`nf-hero-line block ${li === 1 ? "text-neutral-400 dark:text-zinc-500" : ""}`}>
                {li === 1 ? (
                  <>
                    speed of{" "}
                    <span className="relative inline-block text-neutral-900 underline decoration-neutral-300 decoration-[3px] underline-offset-8 dark:text-white dark:decoration-white/40">
                      thought
                    </span>
                    .
                  </>
                ) : (
                  line
                )}
              </span>
            </span>
          ))}
        </h1>

        <p className="nf-fade-up mt-7 max-w-2xl text-pretty text-base leading-relaxed text-neutral-500 [animation-delay:350ms] dark:text-zinc-400 sm:text-lg">
          MLverse is the no-code canvas where anyone can build, train and deploy
          machine-learning pipelines — visually. Drag nodes, connect data, hit train.
          No notebooks. No boilerplate. Just intelligence.
        </p>

        <div className="nf-fade-up mt-10 flex flex-col items-center gap-4 [animation-delay:550ms] sm:flex-row">
          <Link
            href="/build"
            className="nf-button-glow group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-neutral-900 px-7 text-sm font-semibold text-white transition-all duration-300 hover:bg-neutral-700 active:scale-[0.97] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full dark:bg-neutral-900/10" />
            <span className="relative">Start training free</span>
            <ArrowRight size={16} weight="bold" className="relative transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a
            href="#training-demo"
            className="group inline-flex h-12 items-center gap-2.5 rounded-xl border border-neutral-300 bg-white/50 px-7 text-sm font-semibold text-neutral-800 backdrop-blur-md transition-all duration-300 hover:border-neutral-500 hover:bg-white active:scale-[0.97] dark:border-white/15 dark:bg-white/[0.02] dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/[0.06]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 transition-colors group-hover:bg-neutral-700 dark:bg-white/10 dark:group-hover:bg-white">
              <Play size={10} weight="fill" className="translate-x-[1px] text-white dark:text-white" />
            </span>
            Watch how it trains
          </a>
        </div>

        {/* Stats strip */}
        <div className="nf-fade-up mt-20 grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 [animation-delay:750ms] dark:border-white/[0.07] dark:bg-white/[0.04] sm:grid-cols-3">
          {[
            { label: "Models trained", value: 128400, suffix: "+" },
            { label: "Avg. time to first model", value: 94, suffix: "s" },
            { label: "Pipeline uptime", value: 99.98, suffix: "%", decimals: 2 },
          ].map((s) => (
            <div key={s.label} className="bg-white/90 px-6 py-5 backdrop-blur-sm dark:bg-[#07070a]/90">
              <div className="font-mono text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                <CountUp to={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="flex animate-bounce flex-col items-center gap-1 text-neutral-400 dark:text-zinc-600">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em]">Scroll</span>
          <CaretDown size={14} />
        </div>
      </div>

      {/* Side HUD decorations */}
      <div className="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 select-none flex-col items-center gap-4 lg:flex" aria-hidden="true">
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent dark:via-white/15" />
        <span className="rotate-90 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.35em] text-neutral-400 dark:text-zinc-600">
          NF://core.engine.v3
        </span>
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      </div>
      <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none flex-col items-end gap-2 lg:flex" aria-hidden="true">
        {["CPU CLUSTER — ONLINE", "GPU MESH — IDLE", "SYNC — 12MS"].map((t) => (
          <span key={t} className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-neutral-400 dark:text-zinc-600">
            <span className="h-1 w-1 rounded-full bg-emerald-500/80 shadow-[0_0_6px_rgba(16,185,129,0.6)] dark:bg-emerald-400/80 dark:shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
