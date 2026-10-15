import type { ComponentType } from "react";
import {
  ArrowsIn,
  ArrowsLeftRight,
  ArrowsSplit,
  Barbell,
  Brain,
  ChartBar,
  ChartScatter,
  CloudArrowDown,
  Cube,
  Database,
  FileCsv,
  FlowArrow,
  Gauge,
  GitBranch,
  GitCommit,
  Crosshair,
  Images,
  Image,
  Lego,
  MagicWand,
  MagnifyingGlass,
  Minus,
  Network,
  Percent,
  Planet,
  Pulse,
  Record,
  Repeat,
  Sigma,
  SquaresFour,
  Columns,
  Stack,
  StackSimple,
  StackPlus,
  Stethoscope,
  CirclesFour,
  CirclesThreePlus,
  Table,
  TrendUp,
  WaveSine,
  type IconProps,
} from "@phosphor-icons/react";

type IconComponent = ComponentType<IconProps>;

/** Palette icon registry. Keys are the serialized names stored in canvas metadata. */
const REGISTRY: Record<string, IconComponent> = {
  // Data
  FileSpreadsheet: FileCsv,
  Images: Images,
  Database: Database,
  CloudDatabase: CloudArrowDown,
  Boxes: SquaresFour,
  // Preprocessing
  Scale: Barbell,
  MoveHorizontal: ArrowsLeftRight,
  Minimize2: ArrowsIn,
  Sigma: Sigma,
  Wand2: MagicWand,
  Split: ArrowsSplit,
  // Classic ML
  Minus: Minus,
  TrendingUp: TrendUp,
  CircleDot: Record,
  Percent: Percent,
  Crosshair: Crosshair,
  GitBranch: GitBranch,
  Network: Network,
  BarChart3: ChartBar,
  Columns: Columns,
  Combine: Stack,
  Stack: Stack,
  StackPlus: StackPlus,
  GitCommitVertical: GitCommit,
  Gauge: Gauge,
  BrainCircuit: Brain,
  Spline: WaveSine,
  // Deep learning
  Blocks: Lego,
  Image: Image,
  Repeat: Repeat,
  Workflow: FlowArrow,
  Layers: StackSimple,
  Orbit: Planet,
  Table2: Table,
  // Visualization
  Activity: Pulse,
  ScatterChart: ChartScatter,
  Stethoscope: Stethoscope,
  CirclesFour: CirclesFour,
  CirclesThreePlus: CirclesThreePlus,
  MagnifyingGlass: MagnifyingGlass,
};

/** Resolve an icon component by its registry name, with a safe fallback. */
export function resolveIcon(name: string): IconComponent {
  return REGISTRY[name] ?? Cube;
}

/** True if the registry exposes the given icon name. */
export function hasIcon(name: string): boolean {
  return name in REGISTRY;
}
