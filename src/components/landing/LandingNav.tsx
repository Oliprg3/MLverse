"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { List, X, ArrowRight, Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/components/theme/theme-provider";
import { TransitionLink } from "@/components/landing/TransitionLink";

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
  const { resolvedTheme, toggle } = useTheme();

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
          ? "border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#050506]/80"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden bg-transparent">
            <Image
              src="/datlify-mark.png"
              alt="Datlify"
              width={52}
              height={52}
              className="h-full w-full object-contain p-2 dark:brightness-0 dark:invert"
              priority
            />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">Datlify</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3.5 py-2 text-[13px] font-medium text-neutral-500 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <TransitionLink href="/canvas" label="Opening canvas" className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white">
            Open canvas
          </TransitionLink>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            {resolvedTheme === "dark" ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
          </button>
          <Link href="/build" className="group inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-300 hover:bg-neutral-700 active:scale-[0.97] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            Launch App
            <ArrowRight size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            {resolvedTheme === "dark" ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
          </button>
          <button onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 dark:border-white/10 dark:text-zinc-300">
            {open ? <X size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>

      <div className={`overflow-hidden border-b border-neutral-200 bg-white/95 backdrop-blur-xl transition-all duration-400 dark:border-white/[0.06] dark:bg-[#050506]/95 md:hidden ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <nav className="flex flex-col gap-1 px-5 py-4">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-zinc-300 dark:hover:bg-white/[0.05]">
              {l.label}
            </a>
          ))}
          <Link href="/build" className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
            Launch App <ArrowRight size={14} weight="bold" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
