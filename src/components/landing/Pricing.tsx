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
    href: "/build",
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
    href: "/build",
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
    href: "/dashboard",
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
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHead
          index="05"
          kicker="Pricing"
          title={
            <>
              Start free. Scale
              <span className="text-violet-400"> when it ships.</span>
            </>
          }
          copy="No credit card for the free tier. No per-seat math games. Upgrade the moment your first model hits production."
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 110} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-8 transition-all duration-500 ${
                  tier.featured
                    ? "border-violet-500/50 bg-[#0b0716] shadow-[0_0_80px_-24px_rgba(139,92,246,0.45)]"
                    : "border-white/[0.08] bg-white/[0.015] hover:border-white/[0.16]"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_0_20px_-2px_rgba(139,92,246,0.9)]">
                    Most popular
                  </span>
                )}
                <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className={`text-5xl font-semibold tracking-tight ${tier.featured ? "text-white" : "text-zinc-100"}`}>
                    {tier.price}
                  </span>
                  <span className="font-mono text-xs text-zinc-600">/ {tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{tier.copy}</p>
                <ul className="mt-7 flex-1 space-y-3 border-t border-white/[0.06] pt-7">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check size={15} weight="bold" className={`mt-0.5 shrink-0 ${tier.featured ? "text-violet-400" : "text-zinc-600"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
                    tier.featured
                      ? "bg-violet-600 text-white shadow-[0_0_30px_-8px_rgba(139,92,246,0.9)] hover:bg-violet-500"
                      : "border border-white/15 bg-white/[0.03] text-white hover:border-white/30 hover:bg-white/[0.06]"
                  }`}
                >
                  {tier.cta}
                  <ArrowRight size={15} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
