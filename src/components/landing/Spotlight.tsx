"use client";

/**
 * Spotlight — a pointer-following highlight for card surfaces.
 *
 * Writes the cursor position straight to CSS custom properties on the wrapper
 * rather than into React state, so tracking a fast pointer never triggers a
 * re-render. The glow itself lives in .nf-spotlight in globals.css and is
 * disabled for reduced-motion and for touch pointers, where there is no cursor
 * to follow.
 */

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  /** Radius of the glow in pixels. */
  radius?: number;
}

export function Spotlight({ children, className = "", radius = 320 }: SpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  const onMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const x = event.clientX;
    const y = event.clientY;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--nf-mx", `${x - rect.left}px`);
      el.style.setProperty("--nf-my", `${y - rect.top}px`);
      el.style.setProperty("--nf-lit", "1");
    });
  }, []);

  const onLeave = useCallback(() => {
    ref.current?.style.setProperty("--nf-lit", "0");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ "--nf-spot-r": `${radius}px` } as React.CSSProperties}
      className={`nf-spotlight ${className}`}
    >
      {children}
    </div>
  );
}

export default Spotlight;
