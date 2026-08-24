"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface TransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  label?: string;
  /** Milliseconds to hold the loading screen before navigating. */
  delay?: number;
}

/**
 * Link that plays a brief branded loading screen before navigating, so
 * entering the workspace feels deliberate instead of an abrupt swap.
 */
export function TransitionLink({ href, children, className, label = "Preparing your workspace", delay = 1100 }: TransitionLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  // Dismiss the overlay once the target route has actually mounted.
  useEffect(() => {
    if (!pending) return;
    if (pathname !== href) return;
    const t = window.setTimeout(() => setPending(false), 200);
    return () => window.clearTimeout(t);
  }, [pending, pathname, href]);

  // Safety: never trap the user behind the overlay.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(false), 6000);
    return () => window.clearTimeout(t);
  }, [pending]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pending) return;
    setPending(true);
    window.setTimeout(() => router.push(href), delay);
  };

  return (
    <>
      <Link href={href} onClick={onClick} className={className} aria-busy={pending}>
        {children}
      </Link>
      {pending ? (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-white/85 backdrop-blur-xl dark:bg-[#050506]/90" role="status" aria-live="polite">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-white/10 dark:border-t-white" />
            <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500 dark:text-zinc-400">{label}</p>
            <div className="h-0.5 w-44 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
              <span className="nf-route-load block h-full w-full rounded-full bg-neutral-900 dark:bg-white" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default TransitionLink;
