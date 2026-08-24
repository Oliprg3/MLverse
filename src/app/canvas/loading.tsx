import { CanvasLoader } from "@/components/landing/CanvasLoader";

/** Branded splash shown while the canvas route chunk loads. */
export default function CanvasLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#050506]">
      <CanvasLoader label="Preparing your canvas" />
    </div>
  );
}
