"use client";

import {
  Brain,
  Code,
  Database,
  FlowArrow,
  Gear,
  Lightbulb,
  CursorClick,
  Play,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { Modal } from "@/components/ui/modal";

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: Database, title: "1. Add a data source", body: "Drag a node from the left panel: a built-in dataset, your own CSV, or an image folder (sub-folders = classes)." },
  { icon: SlidersHorizontal, title: "2. Preprocess", body: "Optionally chain a Scaler, PCA, Polynomial Features, or Imputer between your data and the model." },
  { icon: Brain, title: "3. Choose a model", body: "Pick from the full scikit-learn suite (trains instantly on the CPU) or a PyTorch architecture (runs on Colab GPU)." },
  { icon: CursorClick, title: "4. Wire the graph", body: "Drag from a node's right handle to the next node's left handle to connect the pipeline." },
  { icon: Gear, title: "5. Configure", body: "Click any node to open the inspector and tune hyperparameters or upload data." },
  { icon: Play, title: "6. Run", body: "Hit the action button. Classic ML returns live Plotly dashboards; deep learning exports a Colab notebook." },
  { icon: Code, title: "7. Export", body: "Open Code to view, copy, or download the real Python generated from your canvas." },
];

export function GuideModal({ open, onClose }: GuideModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title="How to build a pipeline" subtitle="From an empty canvas to a trained, visualized model">
      <div className="space-y-3 p-5">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FlowArrow size={16} className="text-primary" />
            The hybrid execution engine
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Your canvas is read as a directed graph. If it contains only <span className="font-medium text-foreground">Classic ML</span> nodes it
            trains instantly in-app and returns interactive Plotly charts. Add <span className="font-medium text-foreground">Deep Learning</span>
            nodes and it switches to the Colab route, generating a GPU-ready notebook.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.title} className="group rounded-lg border border-border p-3.5 transition-colors hover:border-muted-foreground/40">
              <div className="flex items-center gap-2.5">
                <s.icon size={16} weight="regular" className="shrink-0 text-muted-2" />
                <h3 className="text-[13px] font-semibold text-foreground">{s.title}</h3>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/5 p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#f59e0b]" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Pro tip:</span> delete a node with its trash button (or Backspace), collapse the side
            panel for more canvas room, and toggle light/dark from the header. Every change you make is reflected in the generated Python.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default GuideModal;

