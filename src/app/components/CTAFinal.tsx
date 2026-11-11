import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { AnimatedSection } from "./AnimatedSection";

export function CTAFinal() {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-[120px] bg-[#1A1A1A]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 text-center">
        <AnimatedSection>
          <h2
            className="text-white max-w-lg mx-auto"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            Empezá hoy y recuperá tu tiempo
          </h2>
          <p
            className="mt-4 text-white/55 max-w-md mx-auto"
            style={{ fontSize: "1.0625rem", lineHeight: 1.6 }}
          >
            Configuración en menos de 5 minutos. Sin tarjeta de crédito.
          </p>
          <button
            onClick={() => navigate("/registro")}
            className="mt-8 px-8 py-3.5 bg-[#F97316] text-white rounded-md hover:bg-[#EA6C0A] transition-colors inline-flex items-center gap-2"
            style={{ fontSize: "1rem", fontWeight: 500 }}
          >
            Crear cuenta gratis
            <ArrowRight className="w-4 h-4" />
          </button>
        </AnimatedSection>
      </div>
    </section>
  );
}