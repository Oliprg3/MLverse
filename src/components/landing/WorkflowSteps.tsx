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
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <SectionHead
        index="03"
        kicker="Workflow"
        title={
          <>
            From spreadsheet to production
            <br />
            <span className="text-zinc-500">before your coffee cools.</span>
          </>
        }
      />

      <div className="relative mx-auto max-w-4xl">
        <span
          className="absolute left-[27px] top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-violet-500/60 via-white/10 to-transparent sm:block"
          aria-hidden="true"
        />
        <div className="space-y-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 120}>
              <div className="group relative flex gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 transition-all duration-500 hover:border-violet-500/25 hover:bg-white/[0.03] sm:p-8">
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0e] text-zinc-300 transition-all duration-500 group-hover:border-violet-500/50 group-hover:text-violet-300 group-hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.7)]">
                  <s.icon size={22} weight="duotone" />
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="font-mono text-xs text-violet-400">{s.num}</span>
                      <h3 className="text-lg font-semibold tracking-tight text-white">{s.title}</h3>
                    </div>
                    <p className="max-w-lg text-sm leading-relaxed text-zinc-500">{s.copy}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
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
