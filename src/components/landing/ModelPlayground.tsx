"use client";

/**
 * ModelPlayground — drive a real classifier from the page.
 *
 * The model is a logistic regression on five standardised features. Because the
 * logit is linear, every bar in the contribution panel is that term's exact
 * effect (wᵢ·zᵢ), and the decision boundary is an exact line rather than a
 * sampled approximation. The evaluation half runs the same model over a fixed
 * seeded holdout and recomputes the confusion matrix, precision/recall/F1 and
 * ROC point live as you move the threshold.
 */

import { useMemo, useState } from "react";
import { Target, Sparkle } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";
import { useInView } from "./useInView";
import {
  CHURN_DEFAULT,
  CHURN_FEATURES,
  CHURN_INTERCEPT,
  CHURN_PRESETS,
  boundarySpend,
  buildHoldout,
  metricsAt,
  rocAuc,
  scoreChurn,
  sweepThresholds,
  type ChurnInput,
} from "@/lib/landingLab";

/* ── Formatting ────────────────────────────────────────────────────── */

const signed = (v: number, digits = 2) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

/* ── Probability gauge ─────────────────────────────────────────────── */

const GAUGE_R = 56;
const ARC = "M 10 66 A 56 56 0 0 1 122 66";

function arcPoint(t: number, r = GAUGE_R) {
  const a = Math.PI * (1 - t);
  return { x: 66 + r * Math.cos(a), y: 66 - r * Math.sin(a) };
}

function Gauge({ p, threshold }: { p: number; threshold: number }) {
  const head = arcPoint(p);
  const tickIn = arcPoint(threshold, GAUGE_R - 9);
  const tickOut = arcPoint(threshold, GAUGE_R + 8);

  return (
    <div className="relative">
      <svg viewBox="0 0 132 84" className="w-full max-w-[220px]" aria-hidden="true">
        {/* Track */}
        <path d={ARC} fill="none" strokeWidth={9} strokeLinecap="round" className="stroke-neutral-200 dark:stroke-white/[0.08]" />
        {/* Value arc */}
        <path
          d={ARC}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - p * 100}
          className="stroke-neutral-900 transition-[stroke-dashoffset] duration-500 ease-out dark:stroke-white"
        />
        {/* Threshold rule */}
        <line
          x1={tickIn.x}
          y1={tickIn.y}
          x2={tickOut.x}
          y2={tickOut.y}
          strokeWidth={1.5}
          className="stroke-neutral-900 transition-all duration-300 dark:stroke-white"
          strokeDasharray="2 2"
        />
        {/* Head */}
        <circle
          cx={head.x}
          cy={head.y}
          r={4.5}
          className="fill-white stroke-neutral-900 transition-all duration-500 ease-out dark:fill-[#070709] dark:stroke-white"
          strokeWidth={2}
        />
        <text x="10" y="80" fontSize="7.5" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">0%</text>
        <text x="112" y="80" fontSize="7.5" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">100%</text>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-[22px] text-center">
        <div className="font-mono text-[26px] font-semibold leading-none tabular-nums text-neutral-900 dark:text-white">
          {pct(p)}
        </div>
        <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">
          churn risk
        </div>
      </div>
    </div>
  );
}

/* ── Feature controls ──────────────────────────────────────────────── */

function FeatureControl({
  featureKey,
  value,
  z,
  onChange,
}: {
  featureKey: string;
  value: number;
  z: number;
  onChange: (v: number) => void;
}) {
  const f = CHURN_FEATURES.find((x) => x.key === featureKey);
  if (!f) return null;

  const display =
    f.control === "slider"
      ? `${f.unit ?? ""}${value}${f.suffix ?? ""}`
      : (f.options?.[value] ?? String(value));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-neutral-700 dark:text-zinc-300">
          {f.label}
          <span className="ml-2 font-mono text-[9.5px] font-normal text-neutral-400 dark:text-zinc-600">{f.hint}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-900 dark:text-white">
          {display}
          <span className="ml-2 text-neutral-300 dark:text-zinc-700">z {signed(z)}</span>
        </span>
      </div>

      {f.control === "slider" ? (
        <input
          type="range"
          className="nf-range w-full"
          min={f.min}
          max={f.max}
          step={f.step}
          value={value}
          aria-label={f.label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : (
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
          {(f.options ?? []).map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(i)}
              className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10.5px] transition-colors duration-200 ${
                value === i
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Scatter geometry ──────────────────────────────────────────────── */

const SX0 = 34;
const SX1 = 332;
const SY0 = 10;
const SY1 = 176;
const T_MIN = 1;
const T_MAX = 72;
const S_MIN = 12;
const S_MAX = 190;

const sxOf = (tenure: number) => SX0 + ((tenure - T_MIN) / (T_MAX - T_MIN)) * (SX1 - SX0);
const syOf = (spend: number) => SY1 - ((spend - S_MIN) / (S_MAX - S_MIN)) * (SY1 - SY0);

/* ── ROC geometry ──────────────────────────────────────────────────── */

const RP = 26;
const RSIZE = 168;
const rxOf = (fpr: number) => RP + fpr * RSIZE;
const ryOf = (tpr: number) => RP + RSIZE - tpr * RSIZE;

/* ── Section ───────────────────────────────────────────────────────── */

export function ModelPlayground() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [input, setInput] = useState<ChurnInput>(CHURN_DEFAULT);
  const [threshold, setThreshold] = useState(0.5);

  const live = useMemo(() => scoreChurn(input), [input]);

  // The cohort and its sweep depend only on the (fixed) model, so they are
  // built once the section scrolls in and then reused.
  const cohort = useMemo(() => (inView ? buildHoldout(420) : []), [inView]);
  const sweep = useMemo(() => (cohort.length ? sweepThresholds(cohort, 101) : []), [cohort]);
  const auc = useMemo(() => (sweep.length ? rocAuc(sweep) : 0), [sweep]);
  const m = useMemo(
    () => (cohort.length ? metricsAt(cohort, threshold) : null),
    [cohort, threshold],
  );

  const positives = useMemo(() => cohort.reduce((a, p) => a + p.label, 0), [cohort]);

  /* Contribution ranking — rows are re-ordered by translateY so the reshuffle
     animates instead of snapping. */
  const ROW = 44;
  const ranked = useMemo(
    () => [...live.contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    [live],
  );
  const rankOf = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((c, i) => map.set(c.key, i));
    return map;
  }, [ranked]);
  const maxAbs = Math.max(0.4, ...live.contributions.map((c) => Math.abs(c.contribution)));

  /* Static scatter cloud — memoised so dragging a slider only redraws the
     boundary and the marker, not 420 circles. */
  const cloud = useMemo(
    () => (
      <g>
        {cohort.map((pt, i) =>
          pt.label === 1 ? (
            <circle key={i} cx={sxOf(pt.tenure)} cy={syOf(pt.spend)} r={2.5} className="fill-neutral-900/65 dark:fill-white/60" />
          ) : (
            <circle
              key={i}
              cx={sxOf(pt.tenure)}
              cy={syOf(pt.spend)}
              r={2.3}
              fill="none"
              strokeWidth={0.9}
              className="stroke-neutral-900/35 dark:stroke-white/30"
            />
          ),
        )}
      </g>
    ),
    [cohort],
  );

  // Boundary: the spend at which p equals the threshold, at each end of the
  // tenure axis. Linear in both, so two points define it exactly.
  const bLeft = boundarySpend(T_MIN, threshold, input);
  const bRight = boundarySpend(T_MAX, threshold, input);
  const hasBoundary = bLeft !== null && bRight !== null;
  const byL = hasBoundary ? syOf(bLeft) : 0;
  const byR = hasBoundary ? syOf(bRight) : 0;

  const rocPath = useMemo(() => {
    if (!sweep.length) return "";
    const pts = [...sweep].sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
    return pts.map((s, i) => `${i === 0 ? "M" : "L"} ${rxOf(s.fpr).toFixed(1)} ${ryOf(s.tpr).toFixed(1)}`).join(" ");
  }, [sweep]);

  const flagged = m ? m.tp + m.fp : 0;

  return (
    <section id="playground" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-32 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-neutral-200/50 blur-[130px] dark:bg-white/[0.022]" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="04"
          kicker="Model playground"
          title={
            <>
              Move a slider.{" "}
              <span className="text-neutral-400 dark:text-zinc-500">Watch the model think.</span>
            </>
          }
          copy="A live logistic regression on five features. Every bar is the exact term of the logit it contributes, the boundary is solved rather than sketched, and the metrics below are recomputed over a 420-row holdout each time you move the threshold."
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
                <span className="font-mono text-[11px] text-neutral-400 dark:text-zinc-500">
                  churn_classifier<span className="text-neutral-300 dark:text-zinc-700">.pkl</span>
                </span>
                <div className="flex items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-zinc-600">
                  <span>logistic regression</span>
                  <span className="hidden sm:inline">5 features</span>
                  <span className="text-neutral-700 dark:text-zinc-300">auc {auc ? auc.toFixed(3) : "—"}</span>
                </div>
              </div>

              {/* Inputs + prediction */}
              <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                {/* Controls */}
                <div className="border-b border-neutral-200 p-5 sm:p-6 lg:border-b-0 lg:border-r dark:border-white/[0.07]">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkle size={12} className="text-neutral-400 dark:text-zinc-500" />
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                      One customer
                    </h3>
                  </div>

                  <div className="mb-6 flex flex-wrap gap-1.5">
                    {CHURN_PRESETS.map((preset) => {
                      const active = CHURN_FEATURES.every((f) => input[f.key] === preset.input[f.key]);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setInput(preset.input)}
                          title={preset.note}
                          className={`border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-all duration-300 ${
                            active
                              ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                              : "border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 dark:border-white/10 dark:text-zinc-600 dark:hover:border-white/25 dark:hover:text-zinc-300"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-5">
                    {live.contributions.map((c) => (
                      <FeatureControl
                        key={c.key}
                        featureKey={c.key}
                        value={c.value}
                        z={c.z}
                        onChange={(v) => setInput((prev) => ({ ...prev, [c.key]: v }))}
                      />
                    ))}
                  </div>
                </div>

                {/* Prediction */}
                <div className="grid sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                  <div className="flex flex-col items-center justify-center gap-4 border-b border-neutral-200 p-5 sm:border-b-0 sm:border-r sm:p-6 dark:border-white/[0.07]">
                    <Gauge p={live.p} threshold={threshold} />

                    <span
                      className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                        live.p >= threshold
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                          : "border-emerald-600/40 text-emerald-700 dark:border-emerald-300/30 dark:text-emerald-300"
                      }`}
                    >
                      <Target size={11} />
                      {live.p >= threshold ? "flag · churn" : "hold · retain"}
                    </span>

                    <div className="w-full space-y-1 border-t border-neutral-200 pt-4 font-mono text-[10px] leading-relaxed text-neutral-400 dark:border-white/[0.07] dark:text-zinc-600">
                      <p className="flex justify-between">
                        <span>intercept</span>
                        <span className="tabular-nums text-neutral-600 dark:text-zinc-400">{signed(CHURN_INTERCEPT)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Σ wᵢ·zᵢ</span>
                        <span className="tabular-nums text-neutral-600 dark:text-zinc-400">
                          {signed(live.logit - CHURN_INTERCEPT)}
                        </span>
                      </p>
                      <p className="flex justify-between border-t border-neutral-200 pt-1 dark:border-white/[0.07]">
                        <span>logit</span>
                        <span className="tabular-nums text-neutral-900 dark:text-white">{signed(live.logit)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>σ(logit)</span>
                        <span className="tabular-nums text-neutral-900 dark:text-white">{pct(live.p, 2)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Contributions */}
                  <div className="p-5 sm:p-6">
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                        Logit contributions
                      </h3>
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
                        ranked by |wz|
                      </span>
                    </div>
                    <p className="mb-4 font-mono text-[9.5px] text-neutral-400 dark:text-zinc-600">
                      ← lowers risk <span className="mx-1 opacity-40">|</span> raises risk →
                    </p>

                    <div className="relative" style={{ height: live.contributions.length * ROW }}>
                      <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-200 dark:bg-white/[0.1]" aria-hidden="true" />
                      {live.contributions.map((c) => {
                        const rank = rankOf.get(c.key) ?? 0;
                        const w = (Math.abs(c.contribution) / maxAbs) * 50;
                        const positive = c.contribution >= 0;
                        return (
                          <div
                            key={c.key}
                            className="absolute inset-x-0 top-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ height: ROW, transform: `translateY(${rank * ROW}px)` }}
                          >
                            <div className="flex items-baseline justify-between gap-3 pb-1.5">
                              <span className="truncate font-mono text-[10.5px] text-neutral-600 dark:text-zinc-400">{c.label}</span>
                              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-neutral-900 dark:text-white">
                                {signed(c.contribution)}
                              </span>
                            </div>
                            <div className="relative h-2.5">
                              <span
                                className={`absolute inset-y-0 rounded-[2px] transition-all duration-300 ease-out ${
                                  positive
                                    ? "bg-neutral-900 dark:bg-white"
                                    : "border border-neutral-900 dark:border-white"
                                }`}
                                style={{ left: `${positive ? 50 : 50 - w}%`, width: `${w}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-4 border-t border-neutral-200 pt-4 text-[11.5px] leading-relaxed text-neutral-400 dark:border-white/[0.07] dark:text-zinc-500">
                      Solid bars push the logit up, outlined bars pull it down. They sum to{" "}
                      <span className="font-mono text-neutral-700 dark:text-zinc-300">{signed(live.logit - CHURN_INTERCEPT)}</span>
                      , which is the whole model minus its intercept — no attribution heuristic involved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Boundary + ROC */}
              <div className="grid border-t border-neutral-200 lg:grid-cols-2 dark:border-white/[0.07]">
                <div className="border-b border-neutral-200 p-5 sm:p-6 lg:border-b-0 lg:border-r dark:border-white/[0.07]">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                      Decision boundary
                    </h3>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-600">
                      420 holdout rows
                    </span>
                  </div>

                  <svg viewBox="0 0 342 200" className="w-full" aria-hidden="true">
                    <defs>
                      <clipPath id="nf-pg-plot">
                        <rect x={SX0} y={SY0} width={SX1 - SX0} height={SY1 - SY0} />
                      </clipPath>
                    </defs>

                    {/* Frame + gridlines */}
                    <rect x={SX0} y={SY0} width={SX1 - SX0} height={SY1 - SY0} fill="none" strokeWidth={1} className="stroke-neutral-200 dark:stroke-white/[0.09]" />
                    {[0.25, 0.5, 0.75].map((g) => (
                      <line
                        key={g}
                        x1={SX0}
                        x2={SX1}
                        y1={SY0 + g * (SY1 - SY0)}
                        y2={SY0 + g * (SY1 - SY0)}
                        strokeWidth={1}
                        strokeDasharray="2 4"
                        className="stroke-neutral-200 dark:stroke-white/[0.06]"
                      />
                    ))}

                    <g clipPath="url(#nf-pg-plot)">
                      {hasBoundary ? (
                        <>
                          {/* Flag region — above the boundary the model predicts churn */}
                          <polygon
                            points={`${SX0},${byL} ${SX1},${byR} ${SX1},${SY0} ${SX0},${SY0}`}
                            className="fill-neutral-900/[0.05] transition-all duration-300 dark:fill-white/[0.05]"
                          />
                          <line
                            x1={SX0}
                            y1={byL}
                            x2={SX1}
                            y2={byR}
                            strokeWidth={1.5}
                            strokeDasharray="5 3"
                            className="stroke-neutral-900 transition-all duration-300 dark:stroke-white"
                          />
                        </>
                      ) : null}

                      {cloud}

                      {/* Current customer */}
                      <g className="transition-all duration-300">
                        <line x1={sxOf(input.tenure)} y1={SY0} x2={sxOf(input.tenure)} y2={SY1} strokeWidth={0.8} strokeDasharray="2 3" className="stroke-neutral-900/30 dark:stroke-white/25" />
                        <line x1={SX0} y1={syOf(input.spend)} x2={SX1} y2={syOf(input.spend)} strokeWidth={0.8} strokeDasharray="2 3" className="stroke-neutral-900/30 dark:stroke-white/25" />
                        <circle
                          cx={sxOf(input.tenure)}
                          cy={syOf(input.spend)}
                          r={6}
                          strokeWidth={2}
                          className={`stroke-neutral-900 dark:stroke-white ${
                            live.p >= threshold ? "fill-neutral-900 dark:fill-white" : "fill-white dark:fill-[#070709]"
                          }`}
                        />
                      </g>
                    </g>

                    {/* Axes */}
                    <text x={SX0} y={194} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">{T_MIN} mo</text>
                    <text x={(SX0 + SX1) / 2 - 22} y={194} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">tenure</text>
                    <text x={SX1 - 26} y={194} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">{T_MAX} mo</text>
                    <text x={4} y={SY0 + 8} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">${S_MAX}</text>
                    <text x={4} y={SY1} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">${S_MIN}</text>
                  </svg>

                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">
                    Solid dots churned, outlined dots stayed. The dashed line is solved for p = {threshold.toFixed(2)} at
                    the contract, autopay and ticket values you have set — change those and the whole boundary moves.
                  </p>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                      ROC curve
                    </h3>
                    <span className="font-mono text-[10px] tabular-nums text-neutral-900 dark:text-white">
                      AUC {auc ? auc.toFixed(3) : "—"}
                    </span>
                  </div>

                  <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[300px]" aria-hidden="true">
                    <rect x={RP} y={RP} width={RSIZE} height={RSIZE} fill="none" strokeWidth={1} className="stroke-neutral-200 dark:stroke-white/[0.09]" />
                    {/* Chance line */}
                    <line x1={RP} y1={RP + RSIZE} x2={RP + RSIZE} y2={RP} strokeWidth={1} strokeDasharray="3 4" className="stroke-neutral-300 dark:stroke-white/15" />

                    {rocPath ? (
                      <>
                        <path d={`${rocPath} L ${RP + RSIZE} ${RP + RSIZE} L ${RP} ${RP + RSIZE} Z`} className="fill-neutral-900/[0.06] dark:fill-white/[0.06]" />
                        <path d={rocPath} fill="none" strokeWidth={1.8} strokeLinejoin="round" className="stroke-neutral-900 dark:stroke-white" />
                      </>
                    ) : null}

                    {m ? (
                      <g className="transition-all duration-200">
                        <line x1={RP} y1={ryOf(m.tpr)} x2={rxOf(m.fpr)} y2={ryOf(m.tpr)} strokeWidth={0.8} strokeDasharray="2 3" className="stroke-neutral-900/35 dark:stroke-white/30" />
                        <line x1={rxOf(m.fpr)} y1={RP + RSIZE} x2={rxOf(m.fpr)} y2={ryOf(m.tpr)} strokeWidth={0.8} strokeDasharray="2 3" className="stroke-neutral-900/35 dark:stroke-white/30" />
                        <circle cx={rxOf(m.fpr)} cy={ryOf(m.tpr)} r={4.5} strokeWidth={2} className="fill-white stroke-neutral-900 dark:fill-[#070709] dark:stroke-white" />
                      </g>
                    ) : null}

                    <text x={RP} y={RP + RSIZE + 14} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">0</text>
                    <text x={RP + RSIZE - 44} y={RP + RSIZE + 14} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">FPR 1.0</text>
                    <text x={4} y={RP + 4} fontSize="8" fontFamily="monospace" className="fill-neutral-400 dark:fill-zinc-600">TPR</text>
                  </svg>

                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">
                    Swept over 101 thresholds, integrated by trapezoid. The marker is your current operating point —
                    {m ? ` TPR ${m.tpr.toFixed(2)} at FPR ${m.fpr.toFixed(2)}.` : " drag the threshold below."}
                  </p>
                </div>
              </div>

              {/* Threshold + evaluation */}
              <div className="border-t border-neutral-200 p-5 sm:p-6 dark:border-white/[0.07]">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-zinc-400">
                    Decision threshold
                  </h3>
                  <input
                    type="range"
                    className="nf-range min-w-[180px] flex-1"
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    value={threshold}
                    aria-label="Decision threshold"
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                  <span className="font-mono text-[13px] tabular-nums text-neutral-900 dark:text-white">
                    {threshold.toFixed(2)}
                  </span>
                </div>

                <div className="mt-6 grid gap-7 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                  {/* Confusion matrix */}
                  <div>
                    <p className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600">
                      confusion matrix
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          { k: "TP", v: m?.tp ?? 0, good: true },
                          { k: "FN", v: m?.fn ?? 0, good: false },
                          { k: "FP", v: m?.fp ?? 0, good: false },
                          { k: "TN", v: m?.tn ?? 0, good: true },
                        ] as const
                      ).map((cell) => (
                        <div
                          key={cell.k}
                          className={`flex h-[58px] flex-col items-center justify-center rounded font-mono transition-colors duration-300 ${
                            cell.good
                              ? "bg-neutral-900 text-white dark:bg-white/90 dark:text-neutral-900"
                              : "bg-neutral-200/70 text-neutral-500 dark:bg-white/[0.05] dark:text-zinc-500"
                          }`}
                        >
                          <span className="text-[15px] font-semibold tabular-nums">{cell.v}</span>
                          <span className="mt-0.5 text-[8.5px] uppercase tracking-[0.18em] opacity-70">{cell.k}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2.5 font-mono text-[9px] leading-relaxed text-neutral-400 dark:text-zinc-600">
                      rows = actual · cols = predicted
                    </p>
                  </div>

                  {/* Metrics */}
                  <div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                      {(
                        [
                          { k: "precision", v: m?.precision ?? 0 },
                          { k: "recall", v: m?.recall ?? 0 },
                          { k: "f1", v: m?.f1 ?? 0 },
                          { k: "accuracy", v: m?.accuracy ?? 0 },
                        ] as const
                      ).map((metric) => (
                        <div key={metric.k}>
                          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400 dark:text-zinc-600">
                            {metric.k}
                          </p>
                          <p
                            className={`mt-1 font-mono text-[19px] font-semibold tabular-nums ${
                              metric.k === "accuracy"
                                ? "text-emerald-600 dark:text-emerald-300"
                                : "text-neutral-900 dark:text-white"
                            }`}
                          >
                            {metric.v.toFixed(3)}
                          </p>
                          <div className="mt-2 h-[3px] overflow-hidden bg-neutral-100 dark:bg-white/[0.07]">
                            <div
                              className="h-full bg-neutral-900 transition-[width] duration-300 ease-out dark:bg-white"
                              style={{ width: `${metric.v * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="mt-6 border-t border-neutral-200 pt-4 text-[12px] leading-relaxed text-neutral-500 dark:border-white/[0.07] dark:text-zinc-400">
                      At {threshold.toFixed(2)} the model flags{" "}
                      <span className="font-mono text-neutral-900 dark:text-white">{flagged}</span> of{" "}
                      {cohort.length || "—"} customers and catches{" "}
                      <span className="font-mono text-neutral-900 dark:text-white">{m?.tp ?? 0}</span> of the{" "}
                      {positives} who actually churned — at the cost of{" "}
                      <span className="font-mono text-neutral-900 dark:text-white">{m?.fp ?? 0}</span> false alarms.
                      Lower it to catch more and waste more; raise it to do the opposite. That trade is a business
                      decision, not a modelling one, which is why Datlify leaves it in your hands.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default ModelPlayground;
