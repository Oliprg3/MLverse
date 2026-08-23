"use client";

import {
  ArrowsOut,
  BookOpen,
  CaretRight,
  Code,
  Cpu,
  DownloadSimple,
  FolderOpen,
  Moon,
  Robot,
  Rocket,
  SidebarSimple,
  SquaresFour,
  Sun,
  Trash,
  FloppyDisk,
  CircleNotch,
} from "@phosphor-icons/react";
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
  onBuildAI: () => void;
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

function IconButton({ icon: Icon, label, onClick, className }: { icon: typeof Code; label: string; onClick: () => void; className?: string }) {
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
  onBuildAI,
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
          {paletteOpen ? <SidebarSimple size={18} /> : <SidebarSimple size={18} weight="light" />}
        </Button>

        {/* Bare logo glyph — no box, no gradient */}
        <SquaresFour size={20} weight="bold" className="shrink-0 text-foreground" />

        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
          <span className="font-semibold text-foreground">NeuralForge</span>
          <CaretRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="hidden text-muted-2 sm:inline">Canvas</span>
          <CaretRight className="hidden h-3.5 w-3.5 shrink-0 text-muted xl:block" />
          <span className="hidden items-center gap-1.5 text-[11px] font-medium text-muted-2 xl:inline-flex">
            {route === "colab" ? <Rocket className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
            {route === "colab" ? "Colab GPU" : "Instant CPU"}
          </span>
          <span className="ml-1 hidden items-center border-l border-border pl-2 text-[10px] text-muted-2 2xl:inline-flex">
            {nodeCount} nodes · {edgeCount} links
          </span>
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" onClick={onGuide} className="hidden xl:inline-flex">
          <BookOpen size={16} /> Guide
        </Button>
        <Button variant="ghost" size="sm" onClick={onCode}>
          <Code size={16} /> <span className="hidden sm:inline">Code</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onBuildAI} aria-label="Build with AI" title="Build with AI" className="border border-primary/20 text-primary md:inline-flex">
          <Robot size={16} />
        </Button>
        <Button variant="ghost" size="sm" onClick={onBuildAI} className="hidden border border-primary/20 text-foreground lg:inline-flex">
          <Robot size={16} /> Build with AI
        </Button>
        <IconButton icon={FloppyDisk} label="Save project locally" onClick={onSave} />
        <IconButton icon={FolderOpen} label={hasSavedProject ? "Load saved project" : "No saved project yet"} onClick={onLoad} />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <IconButton icon={ArrowsOut} label="Fit view" onClick={onFit} className="hidden sm:inline-flex" />
        <IconButton icon={DownloadSimple} label="Export pipeline" onClick={onExport} className="hidden md:inline-flex" />
        <IconButton icon={Trash} label="Clear canvas" onClick={onClear} className="hidden sm:inline-flex" />
        <ThemeToggle />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        {/* Primary CTA — no background, no leading action icon. */}
        <Button variant={route === "colab" ? "colab" : "instant"} size="lg" onClick={onExecute} disabled={disabled} className="ml-1 shadow-sm transition-transform active:scale-[0.98]">
          {loading ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : hasModel ? (
            <>
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



