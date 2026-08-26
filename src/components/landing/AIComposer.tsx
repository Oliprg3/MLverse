"use client";

/**
 * AIComposer — type an objective, watch a pipeline get composed.
 *
 * The router in @/lib/promptRouter is a deterministic keyword scorer, not a
 * language model, and the panel says so. Everything it shows — the matched
 * terms, the two competing scores, the node count — is read straight out of the
 * routing result, so the "reasoning" on screen is the actual derivation.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ArrowUpRight,
  Broom,
  ChartLineUp,
  Cpu,
  Database,
  Graph,
  PaperPlaneRight,
  RocketLaunch,
  SlidersHorizontal,
  Sparkle,
  Stack,
  Table,
} from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";
import { useInView } from "./useInView";
import {
  PROMPT_SUGGESTIONS,
  routePrompt,
  type RoutedPlan,
  type StepIcon,
} from "@/lib/promptRouter";

const STEP_ICONS: Record<StepIcon, ComponentType<{ size?: number; className?: string }>> = {
  data: Database,
  clean: Broom,
  encode: Table,
  vector: Stack,
  split: Graph,
  model: Cpu,
  tune: SlidersHorizontal,
  eval: ChartLineUp,
  deploy: RocketLaunch,
};

const ROW_H = 54;
const OPENING = "Predict which customers will churn next quarter";

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-neutral-200 pt-2.5 dark:border-white/[0.07]">
      <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">{label}</p>
      <p className="mt-1 truncate font-mono text-[11.5px] text-neutral-900 dark:text-white" title={value}>
        {value}
      </p>
    </div>
  );
}

export function AIComposer() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const [draft, setDraft] = useState(OPENING);
  const [plan, setPlan] = useState<RoutedPlan | null>(null);
  const [traceCount, setTraceCount] = useState(0);
  const [typing, setTyping] = useState("");
  const [stepCount, setStepCount] = useState(0);
  const started = useRef(false);
  const traceBox = useRef<HTMLDivElement | null>(null);

  // Compose the opening prompt once, when the section first becomes visible.
  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    setPlan(routePrompt(OPENING));
  }, [inView]);

  // Type the derivation out line by line, then materialise the nodes.
  useEffect(() => {
    if (!plan) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let timer: number | undefined;

    if (reduced) {
      // State transitions happen from a timer callback rather than directly in
      // the effect body, preserving the same asynchronous animation contract.
      timer = window.setTimeout(() => {
        setTraceCount(plan.trace.length);
        setTyping("");
        setStepCount(plan.steps.length);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    // Reset in the first animation callback so the effect itself only
    // schedules work and never creates a synchronous render cascade.
    let reset = true;
    let line = 0;
    let ch = 0;
    let step = 0;

    const run = () => {
      if (reset) {
        reset = false;
        setTraceCount(0);
        setTyping("");
        setStepCount(0);
      }
      if (line < plan.trace.length) {
        const text = plan.trace[line];
        ch = Math.min(text.length, ch + 3);
        if (ch >= text.length) {
          setTraceCount(line + 1);
          setTyping("");
          line += 1;
          ch = 0;
          timer = window.setTimeout(run, 190);
        } else {
          setTyping(text.slice(0, ch));
          timer = window.setTimeout(run, 12);
        }
        return;
      }
      if (step < plan.steps.length) {
        step += 1;
        setStepCount(step);
        timer = window.setTimeout(run, 150);
      }
    };

    timer = window.setTimeout(run, 240);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [plan]);

  // Keep the newest trace line in view without yanking the page around.
  useEffect(() => {
    const box = traceBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [traceCount, typing]);

  const compose = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPlan(routePrompt(trimmed));
  };

  const busy = plan ? traceCount < plan.trace.length || stepCount < plan.steps.length : false;
  const spineFill = plan ? Math.max(0, stepCount - 1) / Math.max(1, plan.steps.length - 1) : 0;

  const summary = useMemo(() => {
    if (!plan) return [];
    return [
      { label: "task", value: plan.taskLabel },
      { label: "target", value: plan.target },
      { label: "estimator", value: plan.model },
      { label: "metric", value: plan.metric },
      { label: "sample", value: `${plan.rows.toLocaleString()} × ${plan.features}` },
      { label: "est. train", value: `${plan.estTrainSec}s` },
    ];
  }, [plan]);

  return (
    <section id="ai-composer" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="06"
          kicker="AI composer"
          title={
            <>
              Describe the outcome.{" "}
              <span className="text-neutral-400 dark:text-zinc-500">Get the graph.</span>
            </>
          }
          copy="Say what you want to predict in plain language and a pipeline assembles itself — source, cleaning, encoding, split, estimator, evaluation, endpoint. The panel shows the derivation as it happens, including the runner-up it rejected."
        />

        <Reveal>
          <div ref={ref} className="relative mx-auto max-w-6xl">
            <span className="pointer-events-none absolute -left-3 -top-3 hidden h-8 w-8 border-l border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -right-3 -top-3 hidden h-8 w-8 border-r border-t border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -left-3 hidden h-8 w-8 border-b border-l border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-3 -right-3 hidden h-8 w-8 border-b border-r border-neutral-400 sm:block dark:border-white/30" aria-hidden="true" />

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_60px_120px_-60px_rgba(0,0,0,0.3)] dark:border-white/10 dark:bg-[#070709] dark:shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
              {/* Title bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-5">
                <span className="flex items-center gap-2 font-mono text-[11px] text-neutral-400 dark:text-zinc-500">
                  <Sparkle size={12} className={busy ? "animate-pulse text-neutral-900 dark:text-white" : ""} />
                  prompt<span className="text-neutral-300 dark:text-zinc-700"> → </span>pipeline
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">
                  {busy ? "composing…" : "resolved locally · 0 requests"}
                </span>
              </div>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
                {/* Prompt + derivation */}
                <div className="border-b border-neutral-200 p-5 sm:p-6 lg:border-b-0 lg:border-r dark:border-white/[0.07]">
                  <label
                    htmlFor="nf-composer-input"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400"
                  >
                    Your objective
                  </label>
                  <div className="group relative rounded-xl border border-neutral-200 bg-neutral-50 transition-colors duration-300 focus-within:border-neutral-400 dark:border-white/[0.09] dark:bg-white/[0.03] dark:focus-within:border-white/30">
                    <textarea
                      id="nf-composer-input"
                      value={draft}
                      rows={2}
                      spellCheck={false}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          compose(draft);
                        }
                      }}
                      placeholder="e.g. forecast weekly demand per warehouse"
                      className="w-full resize-none bg-transparent px-3.5 py-3 pr-12 text-[13.5px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => compose(draft)}
                      aria-label="Compose pipeline"
                      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-900"
                    >
                      <PaperPlaneRight size={13} weight="fill" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setDraft(s);
                          compose(s);
                        }}
                        className="max-w-full truncate border border-neutral-200 px-2.5 py-1 text-left font-mono text-[9.5px] text-neutral-400 transition-colors duration-200 hover:border-neutral-400 hover:text-neutral-800 dark:border-white/10 dark:text-zinc-600 dark:hover:border-white/25 dark:hover:text-zinc-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Derivation */}
                  <div className="mt-6">
                    <div className="mb-2.5 flex items-baseline justify-between gap-3">
                      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                        Derivation
                      </h3>
                      {plan ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
                          keyword scorer · deterministic
                        </span>
                      ) : null}
                    </div>

                    <div
                      ref={traceBox}
                      className="scroll-thin h-[150px] overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 dark:border-white/[0.07] dark:bg-black/40"
                    >
                      {plan ? (
                        <ol className="space-y-1.5">
                          {plan.trace.slice(0, traceCount).map((t, i) => (
                            <li key={i} className="flex gap-2.5 font-mono text-[11px] leading-relaxed">
                              <span className="shrink-0 text-neutral-300 dark:text-zinc-700">{String(i + 1).padStart(2, "0")}</span>
                              <span className="text-neutral-600 dark:text-zinc-400">{t}</span>
                            </li>
                          ))}
                          {typing ? (
                            <li className="flex gap-2.5 font-mono text-[11px] leading-relaxed">
                              <span className="shrink-0 text-neutral-300 dark:text-zinc-700">
                                {String(traceCount + 1).padStart(2, "0")}
                              </span>
                              <span className="text-neutral-900 dark:text-white">
                                {typing}
                                <span className="nf-caret ml-0.5 inline-block h-[11px] w-[6px] translate-y-[1px] bg-neutral-900 dark:bg-white" />
                              </span>
                            </li>
                          ) : null}
                        </ol>
                      ) : (
                        <p className="font-mono text-[11px] text-neutral-400 dark:text-zinc-600">
                          waiting for an objective…
                        </p>
                      )}
                    </div>

                    {/* Confidence + matched terms */}
                    {plan ? (
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <div className="min-w-[170px] flex-1">
                          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[9.5px] uppercase tracking-[0.16em]">
                            <span className="text-neutral-400 dark:text-zinc-600">routing confidence</span>
                            <span className="tabular-nums text-neutral-900 dark:text-white">
                              {(plan.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-[3px] overflow-hidden bg-neutral-100 dark:bg-white/[0.07]">
                            <div
                              className="h-full bg-neutral-900 transition-[width] duration-700 ease-out dark:bg-white"
                              style={{ width: `${plan.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {plan.matched.length ? (
                            plan.matched.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[9.5px] text-neutral-500 dark:bg-white/[0.06] dark:text-zinc-400"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="font-mono text-[9.5px] text-neutral-400 dark:text-zinc-600">
                              no terms matched
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Pipeline */}
                <div className="p-5 sm:p-6">
                  <div className="mb-3.5 flex items-baseline justify-between gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                      Composed graph
                    </h3>
                    <span className="font-mono text-[9.5px] tabular-nums text-neutral-400 dark:text-zinc-600">
                      {stepCount}/{plan?.steps.length ?? 0}
                    </span>
                  </div>

                  <div className="relative" style={{ minHeight: (plan?.steps.length ?? 7) * ROW_H }}>
                    {/* Spine */}
                    <span className="absolute left-[17px] top-4 bottom-4 w-px bg-neutral-200 dark:bg-white/[0.08]" aria-hidden="true" />
                    <span
                      className="absolute left-[17px] top-4 w-px origin-top bg-neutral-900 transition-transform duration-500 ease-out dark:bg-white"
                      style={{ bottom: "1rem", transform: `scaleY(${spineFill})` }}
                      aria-hidden="true"
                    />

                    <ol className="relative space-y-0">
                      {(plan?.steps ?? []).map((step, i) => {
                        const Icon = STEP_ICONS[step.icon];
                        const shown = i < stepCount;
                        return (
                          <li
                            key={step.id}
                            className="flex items-center gap-3 transition-all duration-500 ease-out"
                            style={{
                              height: ROW_H,
                              opacity: shown ? 1 : 0,
                              transform: shown ? "none" : "translateX(-10px)",
                            }}
                          >
                            <span
                              className={`relative z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
                                shown
                                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                  : "border-neutral-200 bg-white text-neutral-300 dark:border-white/10 dark:bg-[#070709] dark:text-zinc-700"
                              }`}
                            >
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium text-neutral-900 dark:text-white">
                                {step.label}
                              </span>
                              <span className="block truncate font-mono text-[9.5px] text-neutral-400 dark:text-zinc-600">
                                {step.detail}
                              </span>
                            </span>
                            {step.icon === "deploy" && shown ? (
                              <ArrowUpRight size={12} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t border-neutral-200 px-5 py-5 dark:border-white/[0.07] sm:px-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                  {summary.map((cell) => (
                    <SummaryCell key={cell.label} label={cell.label} value={cell.value} />
                  ))}
                </div>
                <p className="mt-5 text-[11.5px] leading-relaxed text-neutral-400 dark:text-zinc-500">
                  This demo routes with weighted keyword scoring so it can run entirely in your browser — the real
                  builder inside Datlify calls a model and reads your actual schema. The shape of the output is the
                  same: a graph you can open, rewire and run.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default AIComposer;
