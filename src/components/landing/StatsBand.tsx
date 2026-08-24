"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

function Counter({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 2000);
          setVal(to * (1 - Math.pow(2, -10 * p)) * (p === 1 ? 1 : 1));
          if (p < 1) raf = requestAnimationFrame(tick);
          else setVal(to);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className="tabular-nums">
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const STATS = [
  { value: 128400, suffix: "+", label: "models trained on-platform", decimals: 0 },
  { value: 6.4, suffix: "M", label: "predictions served daily", decimals: 1 },
  { value: 94, suffix: "s", label: "median time to first model", decimals: 0 },
  { value: 99.98, suffix: "%", label: "engine uptime last 12 months", decimals: 2 },
];

export function StatsBand() {
  return (
    <section className="border-y border-white/[0.06] bg-[#060608]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} y={18}>
            <div className="relative px-6 py-12 text-center sm:py-16">
              {i > 0 && <span className="absolute inset-y-8 left-0 hidden w-px bg-white/[0.06] sm:block" aria-hidden="true" />}
              <div className="font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                <Counter to={s.value} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
