import { HybridMLCanvas } from "@/components/canvas/HybridMLCanvas";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="h-screen w-full overflow-hidden">
      <HybridMLCanvas />
    </main>
  );
}
