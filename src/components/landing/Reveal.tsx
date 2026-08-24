"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInView } from "./useInView";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "li";
}

export function Reveal({ children, delay = 0, y = 28, className = "", as = "div" }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const Tag = as as "div";
  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
    "--reveal-y": `${y}px`,
  } as CSSProperties;
  return (
    <Tag
      ref={ref}
      style={style}
      className={`nf-reveal ${inView ? "nf-reveal-in" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
