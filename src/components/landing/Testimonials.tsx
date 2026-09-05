"use client";

import {
  ArrowUpRight,
  ChartLineUp,
  CheckCircle,
  CirclesFour,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const SIGNALS = [
  {
    icon: CirclesFour,
    label: "One visual workspace",
    title: "Make the whole pipeline legible",
    copy: "Keep sources, transformations, models, and outputs in one surface. No notebook archaeology or hidden handoffs.",
    tone: "text-sky-600 dark:text-sky-300",
    bg: "bg-sky-500/10",
  },
  {
    icon: Lightning,
    label: "Fast iteration",
    title: "Go from question to experiment",
    copy: "Start with a dataset, wire a baseline, and run it without spending the first hour configuring an environment.",
    tone: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-500/10",
  },
  {
    icon: ChartLineUp,
    label: "Useful outputs",
    title: "Turn model runs into decisions",
    copy: "Inspect metrics, predictions, and charts beside the workflow so the result stays connected to the reasoning.",
    tone: "text-emerald-600 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
  },
];

const PRINCIPLES = [
  "Transparent, editable pipelines",
  "Local-first project persistence",
  "Generated Python when you need it",
  "Clear runtime and validation states",
];

export function Testimonials() {
  return (
    <section className="relative overflow-hidden border-y border-neutral-200/70 bg-neutral-50/70 py-28 sm:py-36 dark:border-white/[0.06] dark:bg-white/[0.015]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-sky-400/[0.07] blur-3xl dark:bg-sky-400/[0.04]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="07"
          kicker="Why Datlify"
          title={<>A clearer way to build with data.</>}
          copy="Skip the made-up success stories. Datlify is designed around a simple promise: make experimentation easier to understand, easier to run, and easier to hand off."
        />

        <div className="grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <Reveal className="h-full">
            <div className="relative flex h-full min-h-[330px] flex-col justify-between overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-950 p-7 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)] sm:p-9 dark:border-white/[0.1] dark:bg-[#0b111a]">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">
                  <ShieldCheck size={15} weight="duotone" /> Built for clarity
                </div>
                <h3 className="mt-8 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
                  Your workflow should explain itself.
                </h3>
                <p className="mt-5 max-w-sm text-sm leading-7 text-white/60">
                  Every node has a purpose, every connection has context, and every run leaves you with an artifact you can inspect.
                </p>
              </div>
              <div className="relative mt-10 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                {PRINCIPLES.map((principle) => (
                  <div key={principle} className="flex items-start gap-2 text-[11px] leading-5 text-white/65">
                    <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-sky-300" />
                    {principle}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {SIGNALS.map((signal, index) => {
              const Icon = signal.icon;
              return (
                <Reveal key={signal.title} delay={index * 90} className="h-full">
                  <div className="group flex h-full items-start gap-5 rounded-3xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] sm:p-7 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:border-white/20">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${signal.bg}`}>
                      <Icon size={21} weight="duotone" className={signal.tone} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-500">{signal.label}</p>
                          <h3 className="mt-2 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{signal.title}</h3>
                        </div>
                        <ArrowUpRight size={17} className="shrink-0 text-neutral-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-zinc-600" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-zinc-400">{signal.copy}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
