import * as LucideIcons from "lucide-react";
import { Box, type LucideIcon } from "lucide-react";

const ICONS = LucideIcons as unknown as Record<string, LucideIcon>;

/** Resolve a Lucide icon by its string name, with a safe fallback. */
export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? Box;
}

/** True if the Lucide library exposes the given icon name. */
export function hasIcon(name: string): boolean {
  return name in ICONS;
}
