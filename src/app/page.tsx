import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { TechMarquee } from "@/components/landing/TechMarquee";
import { Capabilities } from "@/components/landing/Capabilities";
import { TrainingShowcase } from "@/components/landing/TrainingShowcase";
import { WorkflowSteps } from "@/components/landing/WorkflowSteps";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { InteractiveDataGame } from "@/components/landing/InteractiveDataGame";
import { StatsBand } from "@/components/landing/StatsBand";
import { Testimonials } from "@/components/landing/Testimonials";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:bg-[#050506] dark:text-zinc-200 dark:selection:bg-white/90 dark:selection:text-neutral-900">
      <LandingNav />
      <main>
        <Hero />
        <TechMarquee />
        <Capabilities />
        <TrainingShowcase />
        <StatsBand />
        <WorkflowSteps />
        <VideoShowcase />
        <InteractiveDataGame />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
