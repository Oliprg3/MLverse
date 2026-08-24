import Image from "next/image";

/** Branded splash shown while the canvas route chunk loads. */
export default function CanvasLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-white dark:bg-[#050506]" role="status" aria-live="polite">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-white/10 dark:border-t-white" />
        <Image src="/logo.png" alt="Datlify" width={34} height={34} className="h-[34px] w-[34px] object-contain dark:brightness-0 dark:invert" priority />
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500 dark:text-zinc-400">Preparing your canvas</p>
        <div className="h-0.5 w-44 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
          <span className="nf-route-load block h-full w-full rounded-full bg-neutral-900 dark:bg-white" />
        </div>
      </div>
    </div>
  );
}
