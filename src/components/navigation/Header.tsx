"use client";

import {
  BookOpen,
  Boxes,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  FolderOpen,
  Layers3,
  Maximize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Save,
  Sun,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import type { ExecutionRoute } from "@/lib/types";

export interface HeaderProps {
  route: ExecutionRoute;
  hasModel: boolean;
  nodeCount: number;
  edgeCount: number;
  loading: boolean;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onGuide: () => void;
  onCode: () => void;
  onIntegrate: () => void;
  onSave: () => void;
  onLoad: () => void;
  hasSavedProject: boolean;
  onExport: () => void;
  onClear: () => void;
  onFit: () => void;
  onExecute: () => void;
}

function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" title="Toggle light / dark">
      {resolvedTheme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  );
}

function IconButton({ icon: Icon, label, onClick, className }: { icon: typeof Code2; label: string; onClick: () => void; className?: string }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label} className={className}>
      <Icon className="h-[18px] w-[18px]" />
    </Button>
  );
}

export function Header({
  route,
  hasModel,
  nodeCount,
  edgeCount,
  loading,
  paletteOpen,
  onTogglePalette,
  onGuide,
  onCode,
  onIntegrate,
  onSave,
  onLoad,
  hasSavedProject,
  onExport,
  onClear,
  onFit,
  onExecute,
}: HeaderProps) {
  const disabled = !hasModel || loading;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-3 glass-panel">
      {/* Left: brand + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Button variant="ghost" size="icon" onClick={onTogglePalette} aria-label={paletteOpen ? "Hide panel" : "Show panel"} title={paletteOpen ? "Hide panel" : "Show panel"}>
          {paletteOpen ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
        </Button>

        {/* Bare logo glyph — no box, no gradient */}
        <Boxes className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} />

        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
          <span className="font-semibold tracking-tight text-foreground">NeuralForge</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="text-muted-2">Canvas</span>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted sm:block" />
          <span className="hidden items-center gap-1.5 text-[11px] font-medium text-muted-2 sm:inline-flex">
            {route === "colab" ? <Rocket className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
            {route === "colab" ? "Colab GPU" : "Instant CPU"}
          </span>
          <span className="ml-1 hidden items-center gap-1.5 border-l border-border pl-2 text-[10px] text-muted-2 md:inline-flex">
            <span className={hasModel ? "h-1.5 w-1.5 rounded-full bg-emerald-400" : "h-1.5 w-1.5 rounded-full bg-amber-400"} />
            {nodeCount} nodes · {edgeCount} links
          </span>
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" onClick={onGuide} className="hidden md:inline-flex">
          <BookOpen className="h-4 w-4" /> Guide
        </Button>
        <Button variant="ghost" size="sm" onClick={onCode}>
          <Code2 className="h-4 w-4" /> <span className="hidden sm:inline">Code</span>
        </Button>
        <IconButton icon={Layers3} label="Integrate pipeline UI" onClick={onIntegrate} />
        <IconButton icon={Save} label="Save project locally" onClick={onSave} />
        <IconButton icon={FolderOpen} label={hasSavedProject ? "Load saved project" : "No saved project yet"} onClick={onLoad} />
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton icon={Maximize2} label="Fit view" onClick={onFit} />
        <IconButton icon={Download} label="Export pipeline" onClick={onExport} />
        <IconButton icon={Trash2} label="Clear canvas" onClick={onClear} className="hidden sm:inline-flex" />
        <ThemeToggle />
        <div className="mx-1 h-5 w-px bg-border" />

        {/* Primary CTA — no background, no leading action icon. */}
        <Button variant={route === "colab" ? "colab" : "instant"} size="lg" onClick={onExecute} disabled={disabled} className="ml-1 shadow-sm transition-transform active:scale-[0.98]">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasModel ? (
            <>
              <span className={route === "colab" ? "h-1.5 w-1.5 rounded-full bg-indigo-400" : "h-1.5 w-1.5 rounded-full bg-emerald-400"} />
              <span className="hidden sm:inline">{route === "colab" ? "Train on Colab GPU" : "Train Instantly"}</span>
              <span className="sm:hidden">{route === "colab" ? "Colab" : "Train"}</span>
            </>
          ) : (
            <span className="hidden sm:inline">Add a model node</span>
          )}
        </Button>
      </div>
    </header>
  );
}

export default Header;
