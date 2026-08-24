"use client";

import {
  ArrowsOut,
  BookOpen,
  Code,
  DownloadSimple,
  FolderOpen,
  Moon,
  Robot,
  Rocket,
  SidebarSimple,
  Sun,
  Trash,
  UploadSimple,
  FloppyDisk,
  CircleNotch,
  Cpu,
  Play,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/components/theme/theme-provider";
import type { ExecutionRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  onImportWorkflow: () => void;
  onClear: () => void;
  onFit: () => void;
  onExecute: () => void;
}

function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle light / dark"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
    >
      {resolvedTheme === "dark" ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick, className }: { icon: typeof Code; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
        className,
      )}
    >
      <Icon size={17} />
    </button>
  );
}

function GhostAction({ icon: Icon, label, onClick, className }: { icon: typeof Code; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
        className,
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
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
  onImportWorkflow,
  onClear,
  onFit,
  onExecute,
}: HeaderProps) {
  const disabled = !hasModel || loading;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-neutral-200/80 bg-white/85 px-3 glass-panel dark:border-white/[0.06] dark:bg-[#050506]/80 lg:px-4">
      {/* Left — brand + pipeline path */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onTogglePalette}
          aria-label={paletteOpen ? "Hide panel" : "Show panel"}
          title={paletteOpen ? "Hide panel" : "Show panel"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <SidebarSimple size={18} />
        </button>

        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden bg-transparent">
            <Image
              src="/datlify-mark.png"
              alt="Datlify"
              width={40}
              height={40}
              className="h-full w-full object-contain p-1 dark:brightness-0 dark:invert"
              priority
            />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white sm:inline">Datlify</span>
        </Link>

        <span className="hidden h-4 w-px bg-neutral-200 dark:bg-white/10 md:block" aria-hidden />

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="nf-hud-label truncate">canvas://{nodeCount > 0 ? `pipeline (${nodeCount} steps)` : "untitled"}</span>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] 2xl:inline-flex",
              route === "colab"
                ? "border-violet-500/40 text-violet-500"
                : "border-emerald-500/40 text-emerald-500",
            )}
            title={route === "colab" ? "Deep-learning nodes route to a Colab GPU runtime" : "Classic ML trains instantly on CPU"}
          >
            {route === "colab" ? <Rocket size={10} weight="bold" /> : <Cpu size={10} weight="bold" />}
            {route === "colab" ? "GPU" : "CPU"}
          </span>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">
        <GhostAction icon={BookOpen} label="Guide" onClick={onGuide} className="hidden xl:inline-flex" />
        <GhostAction icon={Code} label="Code" onClick={onCode} className="hidden sm:inline-flex" />
        <button
          type="button"
          onClick={onBuildAI}
          className="group hidden h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white/50 px-3 text-[13px] font-semibold text-neutral-800 backdrop-blur-md transition-all duration-300 hover:border-neutral-400 hover:bg-white active:scale-[0.97] dark:border-white/15 dark:bg-white/[0.02] dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/[0.06] md:inline-flex"
        >
          <Robot size={15} className="text-neutral-500 dark:text-zinc-400" />
          <span className="hidden lg:inline">Build with AI</span>
        </button>

        <div className="mx-1 hidden h-5 w-px bg-neutral-200 dark:bg-white/10 sm:block" aria-hidden />

        <IconButton icon={FloppyDisk} label="Save project locally" onClick={onSave} />
        <IconButton icon={FolderOpen} label={hasSavedProject ? "Load saved project" : "No saved project yet"} onClick={onLoad} />
        <IconButton icon={ArrowsOut} label="Fit view" onClick={onFit} className="hidden sm:inline-flex" />
        <IconButton icon={UploadSimple} label="Import workflow (.json)" onClick={onImportWorkflow} className="hidden md:inline-flex" />
        <IconButton icon={DownloadSimple} label="Export workflow (.json)" onClick={onExport} className="hidden md:inline-flex" />
        <IconButton icon={Trash} label="Clear canvas" onClick={onClear} className="hidden sm:inline-flex" />
        <ThemeToggle />

        <div className="mx-1 hidden h-5 w-px bg-neutral-200 dark:bg-white/10 sm:block" aria-hidden />

        {/* Train CTA — matches the landing "Launch App" button */}
        <button
          type="button"
          onClick={onExecute}
          disabled={disabled}
          className={cn(
            "group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-xl px-4 text-[13px] font-semibold transition-all duration-300 active:scale-[0.97]",
            "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:pointer-events-none disabled:opacity-35",
          )}
        >
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full dark:bg-neutral-900/10" />
          {loading ? (
            <CircleNotch size={15} className="relative animate-spin" />
          ) : (
            <Play size={13} weight="fill" className="relative" />
          )}
          <span className="relative hidden sm:inline">
            {loading ? "Training…" : hasModel ? (route === "colab" ? "Train on Colab GPU" : "Train Instantly") : "Add a model node"}
          </span>
          <span className="relative sm:hidden">{loading ? "…" : "Train"}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
