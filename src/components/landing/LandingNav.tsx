"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { List, X, ArrowRight, Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/components/theme/theme-provider";
import { TransitionLink } from "@/components/landing/TransitionLink";

/** `wide` links are held back until there is room for them at lg. */
const LINKS = [
  { label: "Capabilities", href: "#capabilities", wide: false },
  { label: "Data lab", href: "#data-lab", wide: false },
  { label: "Training", href: "#training-demo", wide: true },
  { label: "Playground", href: "#playground", wide: false },
  { label: "Workflow", href: "#workflow", wide: true },
  { label: "Composer", href: "#ai-composer", wide: true },
  { label: "Pricing", href: "#pricing", wide: false },
  { label: "FAQ", href: "#faq", wide: true },
];

const SECTION_IDS = LINKS.map((l) => l.href.slice(1));

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const rail = useRef<HTMLSpanElement | null>(null);
  const { resolvedTheme, toggle } = useTheme();

  // Scrolled state and the progress rail share one listener. The rail is
  // written as a custom property so scrolling never re-renders the header.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 24);
      const span = document.documentElement.scrollHeight - window.innerHeight;
      const progress = span > 0 ? Math.min(1, Math.max(0, y / span)) : 0;
      rail.current?.style.setProperty("--nf-progress", progress.toFixed(4));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Whichever section is crossing the middle of the viewport owns the nav.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        // Keep page order stable rather than trusting callback order.
        const current = SECTION_IDS.find((id) => seen.has(id)) ?? null;
        setActive(current);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
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
          <span className="hidden text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white sm:inline">Datlify</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const isActive = active === l.href.slice(1);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={isActive ? "true" : undefined}
                className={`relative rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  l.wide ? "hidden lg:inline-block" : ""
                } ${
                  isActive
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                }`}
              >
                {l.label}
                <span
                  className={`pointer-events-none absolute inset-x-3 bottom-1 h-px origin-left bg-neutral-900 transition-transform duration-300 ease-out dark:bg-white ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                  aria-hidden="true"
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <TransitionLink href="/canvas" label="Opening canvas" className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white">
            Open canvas
          </TransitionLink>
          <Link href="/auth" className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white">
            Sign in
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            {resolvedTheme === "dark" ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
          </button>
          <Link href="/canvas" className="group inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-300 hover:bg-neutral-700 active:scale-[0.97] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
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

      {/* Reading progress */}
      <span
        ref={rail}
        aria-hidden="true"
        className={`nf-scroll-rail pointer-events-none absolute inset-x-0 bottom-0 h-px bg-neutral-900 transition-opacity duration-500 dark:bg-white ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className={`overflow-hidden border-b border-neutral-200 bg-white/95 backdrop-blur-xl transition-all duration-400 dark:border-white/[0.06] dark:bg-[#050506]/95 md:hidden ${open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"}`}>
        <nav className="flex flex-col gap-1 px-5 py-4">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-white/[0.05] ${
                active === l.href.slice(1)
                  ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-white/[0.05] dark:text-white"
                  : "text-neutral-700 dark:text-zinc-300"
              }`}
            >
              {l.label}
            </a>
          ))}
          <Link href="/canvas" className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
            Launch App <ArrowRight size={14} weight="bold" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
