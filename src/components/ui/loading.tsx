/**
 * loading.tsx — one loading vocabulary for the whole app.
 *
 * Every screen previously invented its own loading state: an inline
 * `animate-spin` here, a pulse there, a progress bar somewhere else, each
 * ignoring reduced-motion. These primitives are the single place that decides
 * what "working" looks like.
 *
 * Craft rules applied throughout:
 *  - Every animation is wrapped so `prefers-reduced-motion: reduce` shows a
 *    static, still-legible state rather than a frozen or spinning one.
 *  - Indeterminate work shows motion only if the visitor wants motion; the
 *    label is always present, so nothing communicates by colour or movement
 *    alone.
 *  - Status uses icon + text, never colour alone, for colour-blind users.
 *  - `role="status"` + `aria-live="polite"` so assistive tech hears progress
 *    without the region being announced repeatedly.
 */

"use client";

import type { ReactNode } from "react";
import { Check, CircleNotch, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/* ── Spinner ──────────────────────────────────────────────────────────────── */

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <CircleNotch
      size={size}
      className={cn("animate-spin motion-reduce:hidden", className)}
      aria-hidden
    />
  );
}

/** Dot that replaces the spinner when motion is reduced, so the row keeps its shape. */
export function SpinnerDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("hidden h-1.5 w-1.5 rounded-full bg-current motion-reduce:block", className)} />;
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-1", className)}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms] motion-reduce:animate-none" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:160ms] motion-reduce:animate-none" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:320ms] motion-reduce:animate-none" />
    </span>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-lg bg-foreground/[0.07] motion-reduce:animate-none motion-reduce:bg-foreground/[0.12]",
        className,
      )}
    />
  );
}

/** A skeleton shaped like a dashboard metric tile. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-6 w-24" />
    </div>
  );
}

/** A skeleton shaped like a Plotly chart area, with a bar profile so it reads
 *  as a chart rather than a grey slab. */
export function SkeletonChart({ className }: { className?: string }) {
  const bars = [38, 62, 45, 80, 55, 71, 48, 66, 40, 58];
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3", className)}>
      <Skeleton className="h-3.5 w-32" />
      <div className="mt-3 flex h-[220px] items-end gap-1.5 px-2 pb-2" aria-hidden>
        {bars.map((height, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-sm bg-foreground/[0.07] motion-reduce:animate-none motion-reduce:bg-foreground/[0.12]"
            style={{ height: `${height}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Status row ───────────────────────────────────────────────────────────── */

export type StatusKind = "running" | "success" | "error";

const STATUS_STYLE: Record<StatusKind, { ring: string; text: string }> = {
  running: { ring: "border-border bg-foreground/[0.03]", text: "text-foreground-2" },
  success: { ring: "border-emerald-500/30 bg-emerald-500/[0.06]", text: "text-emerald-600 dark:text-emerald-400" },
  error: { ring: "border-rose-500/30 bg-rose-500/[0.06]", text: "text-rose-600 dark:text-rose-400" },
};

/**
 * One row of live agent/execution feedback: spinner, label, optional detail.
 * Announced politely so screen readers hear each step as it arrives.
 */
export function StatusRow({
  status,
  label,
  detail,
  className,
}: {
  status: StatusKind;
  label: string;
  detail?: string;
  className?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", style.ring, className)}
    >
      {status === "running" ? (
        <>
          <Spinner size={13} className={style.text} />
          <SpinnerDot className={style.text} />
        </>
      ) : status === "success" ? (
        <Check size={13} weight="bold" className={style.text} />
      ) : (
        <Warning size={13} weight="fill" className={style.text} />
      )}
      <span className={cn("min-w-0 flex-1 truncate text-[12px]", status === "running" ? "text-foreground" : style.text)}>
        {label}
      </span>
      {detail ? <span className="shrink-0 truncate font-mono text-[10px] text-muted-2">{detail}</span> : null}
    </div>
  );
}

/* ── Indeterminate progress ───────────────────────────────────────────────── */

/**
 * A progress bar for work whose duration is genuinely unknown.
 *
 * Deliberately NOT a percentage: fabricating "73%" when nothing measures it is
 * the same class of dishonesty as the old fake agent steps. The bar is
 * labelled as indeterminate, and collapses to a static line under reduced
 * motion.
 */
export function IndeterminateBar({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label ?? "Working"}
      aria-busy="true"
      className={cn("h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08]", className)}
    >
      <div className="h-full w-1/3 rounded-full bg-foreground/60 animate-[nf-indeterminate_1.4s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:w-full motion-reduce:bg-foreground/25" />
    </div>
  );
}

/* ── Full-screen loading ──────────────────────────────────────────────────── */

/**
 * The app-level loading screen. Keeps the existing HUD pipeline motif but
 * gives it a real structure: centred stage, legible label, honest indeterminate
 * progress, and a reduced-motion path that shows the same information without
 * orbiting anything.
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6"
    >
      <PipelineSpinner />
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-2">{label}</p>
        <p className="mt-2 text-sm font-medium text-foreground">Working on it</p>
        <p className="mt-1 text-xs text-muted">This usually takes a moment.</p>
      </div>
      <IndeterminateBar className="w-40" label={label} />
    </div>
  );
}

/** Nodes on a rail with a packet travelling along it — the app's own motif. */
export function PipelineSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-24 w-40", className)} aria-hidden>
      <svg viewBox="0 0 160 96" fill="none" className="absolute inset-0 h-full w-full">
        {/* rails */}
        <path
          d="M20 48 H60 M100 48 H140"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-neutral-200 dark:stroke-white/[0.16]"
        />
        {/* travelling packets */}
        <path
          d="M20 48 H60"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="20 80"
          className="stroke-neutral-900 animate-[nf-dash_1.6s_linear_infinite] motion-reduce:animate-none motion-reduce:stroke-neutral-400 dark:stroke-white"
        />
        <path
          d="M100 48 H140"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="20 80"
          className="stroke-neutral-900 animate-[nf-dash_1.6s_linear_infinite] motion-reduce:animate-none motion-reduce:stroke-neutral-400 dark:stroke-white [animation-delay:400ms]"
        />
        {/* nodes */}
        {[20, 80, 140].map((cx, i) => (
          <g key={cx}>
            <rect
              x={cx - 15}
              y="36"
              width="30"
              height="24"
              rx="7"
              strokeWidth="2"
              className="fill-surface stroke-neutral-200 dark:stroke-white/[0.16]"
            />
            <circle
              cx={cx}
              cy="48"
              r="3.5"
              className={cn(
                "animate-pulse motion-reduce:animate-none",
                i === 1 ? "fill-neutral-900 dark:fill-white" : "fill-neutral-300 dark:fill-white/30",
              )}
              style={i === 2 ? { animationDelay: "800ms" } : undefined}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Button-level loading ─────────────────────────────────────────────────── */

export function ButtonSpinner() {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size={13} />
      <SpinnerDot />
    </span>
  );
}

export function InlineLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-2 text-xs text-muted", className)}>
      <Spinner size={12} />
      <SpinnerDot />
      <span>{label}</span>
    </div>
  );
}

/** Skeleton grid used while a dashboard of results is still streaming. */
export function ResultSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

export function WithSkeleton({ loading, children, fallback }: { loading: boolean; children: ReactNode; fallback?: ReactNode }) {
  if (!loading) return <>{children}</>;
  return <>{fallback ?? <ResultSkeleton />}</>;
}