import Image from "next/image";
import Link from "next/link";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Canvas", href: "/canvas" },
      { label: "AI Builder", href: "/canvas" },
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
              <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden bg-transparent">
                <Image
                  src="/datlify-mark.png"
                  alt="Datlify"
                  width={52}
                  height={52}
                  className="h-full w-full object-contain p-2 dark:brightness-0 dark:invert"
                />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">Datlify</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-zinc-400">
              The no-code AI canvas. Train, evaluate and deploy machine-learning
              models visually — right in your browser.
            </p>
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
          <p className="font-mono text-[11px] text-neutral-400 dark:text-zinc-700">© 2026 Datlify Labs. Built for the post-notebook era.</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400 dark:text-zinc-700">
            NF://core.engine.v3 · <span className="text-neutral-500 dark:text-zinc-500">est. 2024</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
