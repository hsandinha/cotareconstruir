import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { FloatingWhatsapp } from "../components/FloatingWhatsapp";
import { LandingExperience } from "../components/landing/LandingExperience";

export default function HomePage() {
  return (
    <div className="relative bg-[#FAF8F5]">
      <Header />
      <LandingExperience />
      <Footer />
      <FloatingWhatsapp />
    </div>
  );
}
