"use client";

import { Quotes } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const QUOTES = [
  {
    quote:
      "Our marketing team built a churn model in one afternoon. No data science ticket, no two-week backlog. It just… trained.",
    name: "Mara Chen",
    role: "Head of Growth · Loopwire",
    initials: "MC",
  },
  {
    quote:
      "The canvas is what Figma did to design files, but for ML. I can see the whole pipeline and export real Python whenever I want.",
    name: "Diego Alvarez",
    role: "ML Engineer · Northbeam Labs",
    initials: "DA",
  },
  {
    quote:
      "We replaced a stack of notebooks with NeuralForge dashboards. Execs actually look at them — that never happened before.",
    name: "Priya Nair",
    role: "VP Data · Castellan Retail",
    initials: "PN",
  },
  {
    quote:
      "Instant CPU training for prototypes, Colab GPUs for the heavy runs. The hybrid switch alone saves us hundreds per month.",
    name: "Tomas Berg",
    role: "CTO · Fieldnote Analytics",
    initials: "TB",
  },
  {
    quote:
      "I teach an intro ML course on it. Students ship their first model on day one instead of fighting environment setup.",
    name: "Dr. Amara Osei",
    role: "Lecturer · Kingsford Institute",
    initials: "AO",
  },
  {
    quote:
      "From raw CSV to a live prediction endpoint during a client call. The demo closed the deal on the spot.",
    name: "Jonas Reinholt",
    role: "Founder · Reinholt Consulting",
    initials: "JR",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="04"
          kicker="Field notes"
          title={
            <>
              Loved by analysts,
              <br />
              <span className="text-zinc-500">respected by engineers.</span>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={(i % 3) * 100}>
              <figure className="group relative flex h-full flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.015] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.03]">
                <Quotes size={22} weight="fill" className="mb-4 text-violet-500/50 transition-colors duration-500 group-hover:text-violet-400/70" />
                <blockquote className="text-[15px] leading-relaxed text-zinc-300">“{q.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 font-mono text-[11px] font-semibold text-violet-300">
                    {q.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">{q.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-600">{q.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
