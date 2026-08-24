import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { TechMarquee } from "@/components/landing/TechMarquee";
import { Capabilities } from "@/components/landing/Capabilities";
import { TrainingShowcase } from "@/components/landing/TrainingShowcase";
import { WorkflowSteps } from "@/components/landing/WorkflowSteps";
import { StatsBand } from "@/components/landing/StatsBand";
import { Testimonials } from "@/components/landing/Testimonials";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050506] text-zinc-200 antialiased selection:bg-violet-600/40 selection:text-white">
      <LandingNav />
      <main>
        <Hero />
        <TechMarquee />
        <Capabilities />
        <TrainingShowcase />
        <StatsBand />
        <WorkflowSteps />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
