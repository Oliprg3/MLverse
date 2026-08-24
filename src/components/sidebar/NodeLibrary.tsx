"use client";

/* Palette icons are resolved from static metadata at render time. */
/* eslint-disable react-hooks/static-components */

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { CATEGORIES, NODE_PALETTE } from "@/lib/canvasConfig";
import { resolveIcon } from "@/lib/icons";
import type { NodeCategory, PaletteItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: NodeCategory[] = [
  "data",
  "preprocessing",
  "classic_ml",
  "deep_learning",
  "visualization",
];

function LibraryCard({ item }: { item: PaletteItem }) {
  const Icon = resolveIcon(item.icon);

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-all duration-200 hover:border-neutral-200/80 hover:bg-white/60 active:cursor-grabbing active:scale-[0.98] dark:hover:border-white/[0.07] dark:hover:bg-white/[0.03]"
      title={`Drag onto canvas: ${item.label}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200/90 transition-transform duration-200 group-hover:scale-105 dark:border-white/[0.1]">
        <Icon className="h-3.5 w-3.5 text-neutral-500 transition-colors group-hover:text-neutral-800 dark:text-zinc-400 dark:group-hover:text-white" weight="regular" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium leading-tight tracking-tight text-neutral-800 transition-colors group-hover:text-neutral-950 dark:text-zinc-200 dark:group-hover:text-white">{item.label}</div>
        <div className="truncate text-[10px] leading-tight text-neutral-400 dark:text-zinc-500">{item.description}</div>
      </div>
    </div>
  );
}

function Section({ catId, query }: { catId: NodeCategory; query: string }) {
  const [open, setOpen] = useState(true);
  const items = useMemo(() => NODE_PALETTE.filter((i) => i.category === catId), [catId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.type.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (filtered.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-100/60 dark:hover:bg-white/[0.03]"
      >
        <span className="nf-hud-label">{CATEGORIES[catId].label}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[9.5px] font-medium text-neutral-400 dark:text-zinc-600">{filtered.length}</span>
          <CaretDown className={cn("h-3 w-3 text-neutral-400 transition-transform duration-200 dark:text-zinc-600", !open && "-rotate-90")} />
        </span>
      </button>
      <div className={cn("grid transition-all duration-250", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="space-y-0.5 px-1 pb-1 pt-0.5">
            {filtered.map((item) => (
              <LibraryCard key={item.type} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NodeLibrary() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredCount = NODE_PALETTE.filter((item) => {
    if (!hasQuery) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  }).length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-neutral-200/80 bg-white/70 glass-panel max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-2xl dark:bg-[#050506]/60">
      {/* Search */}
      <div className="border-b border-neutral-200/80 p-4 dark:border-white/[0.06]">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-neutral-900 dark:text-white">Node library</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-400 dark:text-zinc-500">Drag a step into the workspace.</p>
          </div>
          <span className="nf-hud-label shrink-0">{NODE_PALETTE.length} nodes</span>
        </div>
        <div className="group relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 dark:text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white/70 pl-8 pr-9 text-[12px] text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-neutral-400 focus:bg-white dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white/30"
          />
          {hasQuery ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-900 dark:text-zinc-500 dark:hover:text-white"
              aria-label="Clear search"
            >
              <X size={11} weight="bold" />
            </button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-neutral-100/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-neutral-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-500">⌘K</kbd>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-2">
        {filteredCount > 0 ? (
          CATEGORY_ORDER.map((catId) => <Section key={catId} catId={catId} query={query} />)
        ) : (
          <div className="animate-fade-in px-3 py-10 text-center">
            <MagnifyingGlass className="mx-auto h-5 w-5 text-neutral-300 dark:text-zinc-600" />
            <p className="mt-3 text-xs font-semibold text-neutral-800 dark:text-zinc-200">No nodes found</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">Try a model, dataset, or visualization name.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-[11px] font-semibold text-neutral-600 underline underline-offset-4 transition-colors hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white">Clear search</button>
          </div>
        )}
      </div>
      <div className="border-t border-neutral-200/80 px-4 py-3 dark:border-white/[0.06]">
        <p className="nf-hud-label">Press ⌘K to search nodes</p>
      </div>
    </aside>
  );
}

export default NodeLibrary;
