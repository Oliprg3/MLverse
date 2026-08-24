"use client";

import { CursorClick, Sparkle, RocketLaunch } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    icon: CursorClick,
    num: "01",
    title: "Drop your data",
    copy: "Upload a CSV, connect an API or paste a table. NeuralForge profiles every column instantly and suggests the right features.",
    tag: "30 seconds",
  },
  {
    icon: Sparkle,
    num: "02",
    title: "Drag — or just describe",
    copy: "Wire nodes on the canvas, or tell the AI Builder what to predict. Either way you get a validated pipeline in seconds.",
    tag: "2 minutes",
  },
  {
    icon: RocketLaunch,
    num: "03",
    title: "Train & ship",
    copy: "Hit train. Watch epochs stream live, compare runs on dashboards, then deploy to a production endpoint with one click.",
    tag: "under 5 minutes",
  },
];

export function WorkflowSteps() {
  return (
    <section id="workflow" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      <SectionHead
        index="03"
        kicker="Workflow"
        title={
          <>
            From spreadsheet to production
            <br />
            <span className="text-neutral-400 dark:text-zinc-500">before your coffee cools.</span>
          </>
        }
      />

      <div className="relative mx-auto max-w-4xl">
        <span
          className="absolute left-[27px] top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-neutral-400 via-neutral-200 to-transparent sm:block dark:from-white/40 dark:via-white/10"
          aria-hidden="true"
        />
        <div className="space-y-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 120}>
              <div className="nf-hud-corners group relative flex gap-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-500 hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)] dark:border-white/[0.06] dark:bg-white/[0.015] dark:hover:border-white/[0.28] dark:hover:bg-white/[0.03] dark:hover:shadow-[0_24px_60px_-32px_rgba(255,255,255,0.12)] sm:p-8">
                <span
                  className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 select-none font-mono text-[88px] font-semibold leading-none tracking-tighter text-neutral-100 transition-colors duration-500 group-hover:text-neutral-200 md:block dark:text-white/[0.04] dark:group-hover:text-white/[0.09]"
                  aria-hidden="true"
                >
                  {s.num}
                </span>
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-all duration-500 group-hover:border-neutral-900 group-hover:bg-neutral-900 group-hover:text-white dark:border-white/10 dark:bg-[#0a0a0e] dark:text-zinc-300 dark:group-hover:border-white dark:group-hover:bg-white dark:group-hover:text-neutral-900">
                  <s.icon size={22} weight="duotone" />
                </div>
                <div className="relative z-10 flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="font-mono text-xs text-neutral-400 transition-colors duration-500 group-hover:text-neutral-900 dark:text-zinc-600 dark:group-hover:text-white">{s.num}</span>
                      <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{s.title}</h3>
                    </div>
                    <p className="max-w-lg text-sm leading-relaxed text-neutral-500 dark:text-zinc-500">{s.copy}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 transition-colors duration-500 group-hover:border-neutral-400 group-hover:text-neutral-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:group-hover:border-white/25 dark:group-hover:text-zinc-200">
                    {s.tag}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
