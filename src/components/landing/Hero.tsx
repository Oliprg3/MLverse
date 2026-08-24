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
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[#030304]">
      {/* Layer 1 — procedural particle network */}
      <div className="absolute inset-0 opacity-70">
        <ParticleField className="h-full w-full" />
      </div>

      {/* Layer 2 — background video */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen"
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

      {/* Layer 3 — dark cinematic overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030304]/70 via-transparent to-[#050506]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050506] to-transparent" />

      {/* HUD grid lines */}
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-36 text-center sm:px-8">
        <div className="nf-fade-up mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-2 pr-4 backdrop-blur-md">
          <span className="rounded-full bg-violet-600 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
            New
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
            v3 · Hybrid GPU engine is live
          </span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        </div>

        <h1 className="max-w-5xl text-balance text-[42px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl md:text-7xl lg:text-[84px]">
          {"Train AI models at the|speed of thought.".split("|").map((line, li) => (
            <span key={li} className="block overflow-hidden pb-1">
              <span className={`nf-hero-line block ${li === 1 ? "text-zinc-500" : ""}`}>
                {li === 1 ? (
                  <>
                    speed of{" "}
                    <span className="relative inline-block text-violet-400">
                      thought
                      <svg viewBox="0 0 220 12" className="absolute -bottom-1 left-0 w-full" aria-hidden="true">
                        <path d="M3 9 C 60 2, 160 2, 217 7" fill="none" stroke="rgba(139,92,246,0.55)" strokeWidth="2.5" strokeLinecap="round" className="nf-underline-draw" />
                      </svg>
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

        <p className="nf-fade-up mt-7 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 [animation-delay:350ms] sm:text-lg">
          NeuralForge is the no-code canvas where anyone can build, train and deploy
          machine-learning pipelines — visually. Drag nodes, connect data, hit train.
          No notebooks. No boilerplate. Just intelligence.
        </p>

        <div className="nf-fade-up mt-10 flex flex-col items-center gap-4 [animation-delay:550ms] sm:flex-row">
          <Link
            href="/build"
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-[0_0_40px_-8px_rgba(139,92,246,0.8)] transition-all duration-300 hover:bg-violet-500 hover:shadow-[0_0_56px_-6px_rgba(139,92,246,1)] active:scale-[0.97]"
          >
            <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative">Start training free</span>
            <ArrowRight size={16} weight="bold" className="relative transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a
            href="#training-demo"
            className="group inline-flex h-12 items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.02] px-7 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.97]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-violet-600">
              <Play size={10} weight="fill" className="translate-x-[1px] text-white" />
            </span>
            Watch how it trains
          </a>
        </div>

        {/* Stats strip */}
        <div className="nf-fade-up mt-20 grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] [animation-delay:750ms] sm:grid-cols-3">
          {[
            { label: "Models trained", value: 128400, suffix: "+" },
            { label: "Avg. time to first model", value: 94, suffix: "s" },
            { label: "Pipeline uptime", value: 99.98, suffix: "%", decimals: 2 },
          ].map((s) => (
            <div key={s.label} className="bg-[#07070a]/90 px-6 py-5 backdrop-blur-sm">
              <div className="font-mono text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                <CountUp to={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="flex animate-bounce flex-col items-center gap-1 text-zinc-600">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em]">Scroll</span>
          <CaretDown size={14} />
        </div>
      </div>

      {/* Side HUD decorations */}
      <div className="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 select-none flex-col items-center gap-4 lg:flex" aria-hidden="true">
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        <span className="rotate-90 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.35em] text-zinc-600">
          NF://core.engine.v3
        </span>
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      </div>
      <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none flex-col items-end gap-2 lg:flex" aria-hidden="true">
        {["CPU CLUSTER — ONLINE", "GPU MESH — IDLE", "SYNC — 12MS"].map((t) => (
          <span key={t} className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-600">
            <span className="h-1 w-1 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
