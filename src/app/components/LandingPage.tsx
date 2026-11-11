import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { HowItWorks } from "./HowItWorks";
import { Benefits } from "./Benefits";
import { Pricing } from "./Pricing";
import { Testimonials } from "./Testimonials";
import { CTAFinal } from "./CTAFinal";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <HeroSection />
      <HowItWorks />
      <Benefits />
      <Pricing />
      <Testimonials />
      <CTAFinal />
      <Footer />
    </div>
  );
}
