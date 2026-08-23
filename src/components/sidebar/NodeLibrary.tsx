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
      className="group flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-foreground/[0.05] active:cursor-grabbing"
      title={`Drag onto canvas: ${item.label}`}
    >
      {/* Bare icon glyph — no box, no border, no tint. */}
      <Icon className="h-4 w-4 shrink-0 text-muted-2 transition-colors group-hover:text-foreground" weight="regular" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-tight tracking-tight text-foreground">{item.label}</div>
        <div className="truncate text-[10px] leading-tight text-muted">{item.description}</div>
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
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{CATEGORIES[catId].label}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted/60">{filtered.length}</span>
          <CaretDown className={cn("h-3.5 w-3.5 text-muted transition-transform duration-200", !open && "-rotate-90")} />
        </span>
      </button>
      <div className={cn("grid transition-all duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface glass-panel max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-2xl">
      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div>
            <p className="text-xs font-semibold tracking-tight text-foreground">Node library</p>
            <p className="mt-0.5 text-[10px] text-muted">Build your pipeline from reusable steps</p>
          </div>
          <span className="rounded-full border border-border bg-foreground/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-2">{NODE_PALETTE.length}</span>
        </div>
        <div className="group relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="h-9 w-full rounded-lg border border-border bg-foreground/[0.03] pl-8 pr-9 text-[13px] text-foreground placeholder:text-muted transition-colors focus:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
          />
          {hasQuery ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={11} weight="bold" />
            </button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-2">⌘K</kbd>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-2">
        {filteredCount > 0 ? (
          CATEGORY_ORDER.map((catId) => <Section key={catId} catId={catId} query={query} />)
        ) : (
          <div className="animate-fade-in px-3 py-10 text-center">
            <MagnifyingGlass className="mx-auto h-5 w-5 text-muted-2" />
            <p className="mt-3 text-xs font-medium text-foreground-2">No nodes found</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Try a model, dataset, or visualization name.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-[11px] font-medium text-primary transition-colors hover:text-foreground">Clear search</button>
          </div>
        )}
      </div>
      <div className="border-t border-border px-3 py-2.5 text-[10px] text-muted">
        <span className="font-medium text-muted-2">Tip</span> · Press <kbd className="font-mono text-foreground-2">⌘K</kbd> to search nodes
      </div>
    </aside>
  );
}

export default NodeLibrary;

