import Link from "next/link";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Canvas", href: "/canvas" },
      { label: "AI Builder", href: "/build" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Live training demo", href: "/#training-demo" },
      { label: "Workflow guide", href: "/#workflow" },
      { label: "FAQ", href: "/#faq" },
      { label: "Capabilities", href: "/#capabilities" },
    ],
  },
  {
    title: "Engine",
    links: [
      { label: "Hybrid execution", href: "/#capabilities" },
      { label: "Code export", href: "/#capabilities" },
      { label: "Deployments", href: "/#training-demo" },
      { label: "Status — all systems go", href: "/api/health" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#040405]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(139,92,246,0.7)]" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                Neural<span className="text-violet-400">Forge</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-600">
              The no-code AI canvas. Train, evaluate and deploy machine-learning
              models visually — right in your browser.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/90">
                All systems operational
              </span>
            </div>
          </div>

          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">{col.title}</h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-zinc-400 transition-colors duration-200 hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="font-mono text-[11px] text-zinc-700">© 2026 NeuralForge Labs. Built for the post-notebook era.</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
            NF://core.engine.v3 · <span className="text-zinc-500">est. 2024</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
