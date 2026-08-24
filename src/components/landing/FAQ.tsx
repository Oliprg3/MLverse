"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. The entire pipeline — data import, cleaning, model selection, training and deployment — is visual. If you can use a whiteboard, you can use NeuralForge. And if you do code, every canvas exports to clean Python so nothing is locked away.",
  },
  {
    q: "How does the hybrid engine work?",
    a: "Small and medium datasets train instantly inside your browser using our compiled in-process engine — no queue, no cold start. When a dataset or model needs serious compute, the same canvas transparently dispatches the run to a Colab GPU session with one toggle.",
  },
  {
    q: "What models can I train?",
    a: "Classification, regression, clustering and time-series forecasting using battle-tested libraries under the hood: XGBoost, LightGBM, Scikit-Learn, PyTorch and more. The AI Builder picks sensible defaults; the inspector exposes every hyperparameter.",
  },
  {
    q: "Where does my data live?",
    a: "Datasets stay on your machine unless you explicitly deploy. Browser-side execution means sensitive CSVs never leave your device during training. Enterprise plans add private VPC execution and full audit logs.",
  },
  {
    q: "Can I export what I build?",
    a: "Always. Export idiomatic Python notebooks, standalone scripts, workflow JSON for version control, or ship a live REST endpoint. Your work is portable by design.",
  },
  {
    q: "Is there a free tier really free?",
    a: "Yes — unlimited projects, unlimited instant CPU training and three GPU runs per month, forever. No credit card required to start.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionHead
          index="06"
          kicker="FAQ"
          align="left"
          title={
            <>
              Questions,
              <br />
              <span className="text-zinc-500">answered straight.</span>
            </>
          }
        />
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 60} y={16}>
                <div
                  className={`overflow-hidden rounded-xl border transition-all duration-400 ${
                    isOpen ? "border-violet-500/30 bg-white/[0.03]" : "border-white/[0.07] bg-white/[0.01] hover:border-white/[0.14]"
                  }`}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                  >
                    <span className={`text-[15px] font-medium transition-colors ${isOpen ? "text-white" : "text-zinc-300"}`}>
                      {f.q}
                    </span>
                    <Plus
                      size={17}
                      weight="bold"
                      className={`shrink-0 transition-transform duration-400 ${isOpen ? "rotate-45 text-violet-400" : "text-zinc-600"}`}
                    />
                  </button>
                  <div className={`grid transition-all duration-400 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-sm leading-relaxed text-zinc-500">{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
