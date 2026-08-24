"use client";

import { Quotes, Star } from "@phosphor-icons/react";
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
      "We replaced a stack of notebooks with Datlify dashboards. Execs actually look at them — that never happened before.",
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
              <span className="text-neutral-400 dark:text-zinc-500">respected by engineers.</span>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={(i % 3) * 100} className="h-full">
              <figure className="nf-hud-corners group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-7 transition-all duration-500 hover:-translate-y-1 hover:border-neutral-900 hover:bg-neutral-50 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.3)] dark:border-white/[0.06] dark:bg-white/[0.015] dark:hover:border-white/[0.2] dark:hover:bg-white/[0.03] dark:hover:shadow-[0_24px_60px_-32px_rgba(255,255,255,0.12)]">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <Quotes
                      size={22}
                      weight="fill"
                      className="text-neutral-300 transition-colors duration-500 group-hover:text-neutral-900 dark:text-zinc-700 dark:group-hover:text-zinc-200"
                    />
                    <span className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} size={10} weight="fill" className="text-neutral-400 dark:text-zinc-500" />
                      ))}
                    </span>
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-neutral-700 dark:text-zinc-300">“{q.quote}”</blockquote>
                </div>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-neutral-100 pt-5 dark:border-white/[0.06]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 font-mono text-[11px] font-semibold text-neutral-700 transition-colors duration-500 group-hover:border-neutral-900 group-hover:bg-neutral-900 group-hover:text-white dark:border-white/20 dark:bg-white/10 dark:text-zinc-300 dark:group-hover:border-white dark:group-hover:bg-white dark:group-hover:text-neutral-900">
                    {q.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-neutral-900 dark:text-white">{q.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-neutral-400 dark:text-zinc-600">{q.role}</span>
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
