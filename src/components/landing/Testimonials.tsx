"use client";

import { ArrowUpRight, Check, CirclesFour, Code, Lightning, PresentationChart } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const PRINCIPLES = [
  {
    icon: CirclesFour,
    index: "01",
    title: "See the whole system",
    copy: "Data, transformations, models, and outputs stay connected on one visual canvas.",
  },
  {
    icon: Lightning,
    index: "02",
    title: "Move from idea to run",
    copy: "Build a baseline quickly, validate the pipeline, and iterate without environment overhead.",
  },
  {
    icon: PresentationChart,
    index: "03",
    title: "Make results legible",
    copy: "Metrics, predictions, and charts live beside the workflow that produced them.",
  },
  {
    icon: Code,
    index: "04",
    title: "Keep your options open",
    copy: "Start visually, then inspect or export generated Python whenever you need more control.",
  },
];

const CHECKS = ["Readable by design", "Local-first projects", "Clear runtime states"];

export function Testimonials() {
  return (
    <section className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="07"
          kicker="Built for the work"
          title={
            <>
              Less setup.
              <br />
              <span className="text-neutral-400 dark:text-zinc-500">More signal.</span>
            </>
          }
          copy="Datlify gives you a clear surface for exploring data and building models — without pretending the hard parts do not matter."
        />

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1.85fr]">
          <Reveal className="h-full">
            <div className="nf-hud-corners group relative flex h-full min-h-[330px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950 p-7 text-white shadow-[0_28px_70px_-42px_rgba(0,0,0,0.6)] sm:p-8 dark:border-white/[0.14] dark:bg-white/[0.035]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.07),transparent_38%,transparent)] opacity-80" />
              <div className="relative">
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
                  <span className="h-px w-7 bg-white/35" /> Product principle
                </div>
                <h3 className="mt-8 max-w-sm text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                  Your workflow should explain itself.
                </h3>
                <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
                  Every node has a purpose. Every connection has context. Every run leaves an artifact you can inspect.
                </p>
              </div>
              <div className="relative mt-10 border-t border-white/15 pt-5">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {CHECKS.map((check) => (
                    <span key={check} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/55">
                      <Check size={12} weight="bold" className="text-white/80" /> {check}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {PRINCIPLES.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <Reveal key={principle.index} delay={index * 80} className="h-full">
                  <div className="nf-hud-corners group relative flex h-full min-h-[158px] flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-500 hover:-translate-y-1 hover:border-neutral-900 hover:bg-neutral-50 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.3)] dark:border-white/[0.07] dark:bg-white/[0.015] dark:hover:border-white/[0.2] dark:hover:bg-white/[0.03]">
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 dark:border-white/[0.1] dark:text-zinc-400">
                        <Icon size={17} weight="duotone" />
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.18em] text-neutral-300 dark:text-zinc-700">{principle.index}</span>
                    </div>
                    <div className="mt-7">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">{principle.title}</h3>
                        <ArrowUpRight size={15} className="shrink-0 text-neutral-300 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-zinc-700" />
                      </div>
                      <p className="mt-2 text-[13px] leading-5 text-neutral-500 dark:text-zinc-500">{principle.copy}</p>
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
