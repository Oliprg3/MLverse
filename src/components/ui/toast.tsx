"use client";

import { useEffect } from "react";
import { Warning, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ToastData {
  id: number;
  message: string;
  tone?: "success" | "warn";
}

export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  const Icon = toast.tone === "warn" ? Warning : Check;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div className="animate-slide-up pointer-events-auto flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-2xl">
        <Icon className={cn("h-4 w-4 shrink-0", toast.tone === "warn" ? "text-amber-400" : "text-emerald-400")} />
        <span className="text-[13px] tracking-tight text-foreground">{toast.message}</span>
      </div>
    </div>
  );
}

export default Toast;
