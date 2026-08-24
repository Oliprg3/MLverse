"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-neutral-200 py-32 dark:border-white/[0.06] sm:py-44">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(0,0,0,0.035),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,255,255,0.04),transparent_70%)]" />
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <Reveal>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 dark:text-zinc-500">
            [ Initialize ]
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-6xl md:text-7xl">
            Your first model is
            <br />
            <span className="text-neutral-400 underline decoration-neutral-300 decoration-[3px] underline-offset-8 dark:text-zinc-500 dark:decoration-white/40">
              94 seconds away.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-neutral-500 dark:text-zinc-400">
            Open the canvas, drop a dataset, hit train. That&apos;s the whole onboarding.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/build"
              className="group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-xl bg-neutral-900 px-9 py-3.5 text-base font-semibold text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] transition-all duration-300 hover:bg-neutral-700 active:scale-[0.97] dark:bg-white dark:text-neutral-900 dark:shadow-[0_0_48px_-16px_rgba(255,255,255,0.45)] dark:hover:bg-neutral-200"
            >
              <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full dark:bg-neutral-900/10" />
              <span className="relative">Launch NeuralForge</span>
              <ArrowRight size={17} weight="bold" className="relative transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/canvas"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white/50 px-9 py-3.5 text-base font-semibold text-neutral-800 backdrop-blur-md transition-all duration-300 hover:border-neutral-500 hover:bg-white active:scale-[0.97] dark:border-white/15 dark:bg-white/[0.02] dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/[0.06]"
            >
              Open the workspace
            </Link>
          </div>
        </Reveal>
        <Reveal delay={400}>
          <div className="mt-8 flex items-center justify-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400 dark:text-zinc-600">
              free forever tier · no credit card · runs in your browser
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
