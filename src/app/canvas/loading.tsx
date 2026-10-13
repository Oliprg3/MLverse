import { LoadingScreen } from "@/components/ui/loading";

/** Branded splash shown while the canvas route chunk loads. */
export default function CanvasLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#050506]">
      <LoadingScreen label="Preparing your canvas" />
    </div>
  );
}