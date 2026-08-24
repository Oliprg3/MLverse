"use client";

const STACK = [
  "PyTorch",
  "TensorFlow",
  "Scikit-Learn",
  "XGBoost",
  "LightGBM",
  "Pandas",
  "NumPy",
  "Plotly",
  "Hugging Face",
  "ONNX Runtime",
];

export function TechMarquee() {
  const items = [...STACK, ...STACK];
  return (
    <section className="relative border-y border-white/[0.06] bg-[#060608] py-6" aria-label="Supported libraries">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#060608] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#060608] to-transparent" />
      <div className="nf-marquee-mask overflow-hidden">
        <div className="nf-marquee flex w-max items-center gap-14 pr-14">
          {items.map((name, i) => (
            <span key={`${name}-${i}`} className="flex items-center gap-14">
              <span className="whitespace-nowrap font-mono text-sm font-medium uppercase tracking-[0.22em] text-zinc-600 transition-colors duration-300 hover:text-zinc-200">
                {name}
              </span>
              <span className="h-1.5 w-1.5 rotate-45 border border-violet-500/40" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
