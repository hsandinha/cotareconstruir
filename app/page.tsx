import { Header } from "../components/Header";
import { HeroSection } from "../components/HeroSection";
import { ChallengesSection } from "../components/ChallengesSection";
import { SolutionSection } from "../components/SolutionSection";
import { MethodologySection } from "../components/MethodologySection";
import { BenefitsSection } from "../components/BenefitsSection";
import { CtaSection } from "../components/CtaSection";
import { Footer } from "../components/Footer";
import { FloatingWhatsapp } from "../components/FloatingWhatsapp";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-blue-500/20 via-transparent to-transparent pointer-events-none" />
      <Header />
      <main className="mt-24 space-y-32 md:space-y-36">
        <HeroSection />
        <ChallengesSection />
        <SolutionSection />
        <MethodologySection />
        <BenefitsSection />
        <CtaSection />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </div>
  );
}
