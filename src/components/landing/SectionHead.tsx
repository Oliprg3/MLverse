import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface SectionHeadProps {
  index: string;
  kicker: string;
  title: ReactNode;
  copy?: string;
  align?: "center" | "left";
}

export function SectionHead({ index, kicker, title, copy, align = "center" }: SectionHeadProps) {
  const centered = align === "center";
  return (
    <div className={`mb-16 ${centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      <Reveal>
        <div className={`mb-4 flex items-center gap-3 ${centered ? "justify-center" : ""}`}>
          <span className="font-mono text-xs text-neutral-900 dark:text-white">{index}</span>
          <span className="h-px w-8 bg-neutral-300 dark:bg-white/30" />
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-400 dark:text-zinc-500">{kicker}</span>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white sm:text-4xl md:text-5xl">
          {title}
        </h2>
      </Reveal>
      {copy ? (
        <Reveal delay={200}>
          <p className={`mt-5 text-pretty leading-relaxed text-neutral-500 dark:text-zinc-400 ${centered ? "mx-auto max-w-2xl" : ""}`}>
            {copy}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}
