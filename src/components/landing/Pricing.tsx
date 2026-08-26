"use client";

import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { SectionHead } from "./SectionHead";
import { Reveal } from "./Reveal";

const TIERS = [
  {
    name: "Explorer",
    price: "$0",
    period: "forever",
    copy: "For your first model and every experiment after.",
    cta: "Start free",
    href: "/canvas",
    features: [
      "Unlimited canvas projects",
      "Instant CPU training",
      "3 GPU runs / month",
      "CSV & API data sources",
      "Community support",
    ],
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    copy: "For practitioners shipping models to production.",
    cta: "Go Pro",
    href: "/canvas",
    features: [
      "Everything in Explorer",
      "Unlimited Colab GPU training",
      "AI Builder — full access",
      "Production endpoints & autoscaling",
      "Run comparison dashboards",
      "Python + notebook export",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    copy: "For teams that need scale, security and control.",
    cta: "Talk to us",
    href: "/canvas",
    features: [
      "Everything in Pro",
      "SSO / SAML & audit logs",
      "Private VPC execution",
      "Custom model registry",
      "Dedicated success engineer",
    ],
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="08"
          kicker="Pricing"
          title={
            <>
              Start free. Scale
              <span className="text-neutral-400 dark:text-zinc-500"> when it ships.</span>
            </>
          }
          copy="No credit card for the free tier. No per-seat math games. Upgrade the moment your first model hits production."
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 110} className="h-full">
              <div
                className={`nf-hud-corners group relative flex h-full flex-col overflow-hidden rounded-2xl border p-8 transition-all duration-500 ${
                  tier.featured
                    ? "border-neutral-900 bg-white shadow-[0_40px_90px_-48px_rgba(0,0,0,0.5)] dark:border-white dark:bg-white/[0.04] dark:shadow-[0_0_80px_-40px_rgba(255,255,255,0.25)]"
                    : "border-neutral-200 bg-white hover:-translate-y-1 hover:border-neutral-900 hover:bg-neutral-50 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.3)] dark:border-white/[0.08] dark:bg-white/[0.015] dark:hover:border-white/[0.28] dark:hover:bg-white/[0.03] dark:hover:shadow-[0_24px_60px_-32px_rgba(255,255,255,0.12)]"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-900 px-3.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] dark:bg-white dark:text-neutral-900">
                    Most popular
                  </span>
                )}
                <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-zinc-400">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight text-neutral-900 transition-colors duration-500 group-hover:text-black dark:text-white sm:text-[56px] sm:leading-none">
                    {tier.price}
                  </span>
                  <span className="font-mono text-xs text-neutral-400 dark:text-zinc-600">/ {tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-zinc-500">{tier.copy}</p>
                <ul className="mt-7 flex-1 space-y-3 border-t border-neutral-100 pt-7 dark:border-white/[0.06]">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-zinc-300">
                      <Check
                        size={15}
                        weight="bold"
                        className={`mt-0.5 shrink-0 transition-colors duration-500 ${
                          tier.featured
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-300 group-hover:text-neutral-700 dark:text-zinc-700 dark:group-hover:text-zinc-300"
                        }`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`group/btn mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
                    tier.featured
                      ? "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                      : "border border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/[0.03] dark:text-white dark:hover:border-white/30 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {tier.cta}
                  <ArrowRight size={15} weight="bold" className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
