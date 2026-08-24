import Image from "next/image";
import Link from "next/link";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Canvas", href: "/canvas" },
      { label: "AI Builder", href: "/build" },
      { label: "Launch workspace", href: "/canvas" },
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
    <footer className="border-t border-neutral-200 bg-neutral-50 dark:border-white/[0.06] dark:bg-[#030304]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-white/15 dark:bg-white">
                <Image src="/logo.png" alt="MLverse" width={36} height={36} className="h-full w-full object-contain p-1" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">MLverse</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-zinc-600">
              The no-code AI canvas. Train, evaluate and deploy machine-learning
              models visually — right in your browser.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 dark:bg-emerald-400" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300/90">
                All systems operational
              </span>
            </div>
          </div>

          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400 dark:text-zinc-500">{col.title}</h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-neutral-500 transition-colors duration-200 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-8 dark:border-white/[0.06] sm:flex-row">
          <p className="font-mono text-[11px] text-neutral-400 dark:text-zinc-700">© 2026 MLverse Labs. Built for the post-notebook era.</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400 dark:text-zinc-700">
            NF://core.engine.v3 · <span className="text-neutral-500 dark:text-zinc-500">est. 2024</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
