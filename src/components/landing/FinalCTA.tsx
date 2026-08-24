"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { ParticleField } from "./ParticleField";
import { Reveal } from "./Reveal";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] py-32 sm:py-44">
      {/* backdrop */}
      <div className="absolute inset-0 opacity-40">
        <ParticleField className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,255,255,0.04),transparent_70%)]" />
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <Reveal>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            [ Initialize ]
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl md:text-7xl">
            Your first model is
            <br />
            <span className="text-violet-400">94 seconds away.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-zinc-400">
            Open the canvas, drop a dataset, hit train. That&apos;s the whole onboarding.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/build"
              className="group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-xl bg-violet-600 px-9 py-3.5 text-base font-semibold text-white shadow-[0_0_48px_-8px_rgba(139,92,246,0.9)] transition-all duration-300 hover:bg-violet-500 active:scale-[0.97]"
            >
              <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
              <span className="relative">Launch NeuralForge</span>
              <ArrowRight size={17} weight="bold" className="relative transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-9 py-3.5 text-base font-semibold text-zinc-200 backdrop-blur-md transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.97]"
            >
              Explore the dashboard
            </Link>
          </div>
        </Reveal>
        <Reveal delay={400}>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
            free forever tier · no credit card · runs in your browser
          </p>
        </Reveal>
      </div>
    </section>
  );
}
