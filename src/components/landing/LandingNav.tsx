"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { List, X, ArrowRight } from "@phosphor-icons/react";

const LINKS = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "Live Training", href: "#training-demo" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-[#050506]/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 rounded-lg border border-violet-500/40 bg-violet-500/10 transition-all duration-300 group-hover:bg-violet-500/20" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(139,92,246,0.7)]" />
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full p-1.5 text-zinc-300">
              <circle cx="12" cy="4" r="1.4" fill="currentColor" />
              <circle cx="5" cy="17" r="1.4" fill="currentColor" />
              <circle cx="19" cy="17" r="1.4" fill="currentColor" />
              <path d="M12 4 L5 17 M12 4 L19 17 M5 17 L19 17" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Neural<span className="text-violet-400">Forge</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/dashboard"
            className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/build"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.65)] transition-all duration-300 hover:bg-violet-500 hover:shadow-[0_0_32px_-4px_rgba(139,92,246,0.85)] active:scale-[0.97]"
          >
            Launch App
            <ArrowRight size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 md:hidden"
        >
          {open ? <X size={18} /> : <List size={18} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-b border-white/[0.06] bg-[#050506]/95 backdrop-blur-xl transition-all duration-400 md:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05]"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/build"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Launch App <ArrowRight size={14} weight="bold" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
