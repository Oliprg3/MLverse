/**
 * Square HUD-style route loader. An orbiting stroke traces a rounded square
 * frame while a miniature data pipeline (three nodes + a travelling packet)
 * plays inside it and binary bits flicker around the edges.
 */
export function CanvasLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-6" role="status" aria-live="polite">
      <div className="relative h-28 w-28">
        {/* Flickering binary bits */}
        <span className="nf-bit absolute -left-6 top-1 font-mono text-[10px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "0ms" }}>01</span>
        <span className="nf-bit absolute -right-7 top-7 font-mono text-[10px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "380ms" }}>10</span>
        <span className="nf-bit absolute -left-5 bottom-6 font-mono text-[10px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "760ms" }}>1</span>
        <span className="nf-bit absolute -right-5 -bottom-2 font-mono text-[10px] text-neutral-400 dark:text-zinc-500" style={{ animationDelay: "1120ms" }}>0</span>

        {/* Square frame + orbiting stroke */}
        <svg viewBox="0 0 100 100" fill="none" aria-hidden className="absolute inset-0 h-full w-full">
          <rect x="6" y="6" width="88" height="88" rx="18" strokeWidth="2.5" className="stroke-neutral-200 dark:stroke-white/[0.14]" />
          <rect
            x="6" y="6" width="88" height="88" rx="18" strokeWidth="2.5" strokeLinecap="round"
            pathLength={100} strokeDasharray="16 84"
            className="nf-square-orbit stroke-neutral-900 dark:stroke-white"
          />
        </svg>

        {/* Miniature pipeline: nodes + travelling data packet */}
        <svg viewBox="0 0 100 100" fill="none" aria-hidden className="absolute inset-0 h-full w-full">
          <path d="M31 64 L50 40 L69 64" strokeWidth="2.5" strokeLinecap="round" className="stroke-neutral-200 dark:stroke-white/[0.14]" />
          <path
            d="M31 64 L50 40 L69 64" strokeWidth="2.5" strokeLinecap="round"
            pathLength={100} strokeDasharray="12 88"
            className="nf-data-packet stroke-neutral-900 dark:stroke-white"
          />
          <circle cx="31" cy="64" r="3.5" className="fill-neutral-300 dark:fill-white/25" />
          <circle cx="50" cy="40" r="3.5" className="fill-neutral-300 dark:fill-white/25" />
          <circle cx="69" cy="64" r="3.5" className="fill-neutral-300 dark:fill-white/25" />
          <circle cx="31" cy="64" r="3.5" className="nf-node-ping fill-neutral-900 dark:fill-white" />
          <circle cx="50" cy="40" r="3.5" className="nf-node-ping fill-neutral-900 dark:fill-white" style={{ animationDelay: "550ms" }} />
          <circle cx="69" cy="64" r="3.5" className="nf-node-ping fill-neutral-900 dark:fill-white" style={{ animationDelay: "1100ms" }} />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500 dark:text-zinc-400">{label}</p>
        <div className="h-0.5 w-44 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
          <span className="nf-route-load block h-full w-full rounded-full bg-neutral-900 dark:bg-white" />
        </div>
      </div>
    </div>
  );
}

export default CanvasLoader;
