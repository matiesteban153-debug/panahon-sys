import {
  Smartphone,
  Calculator,
  FileSpreadsheet,
  ThumbsUp,
  Globe,
  Headphones,
} from "lucide-react";
import { AnimatedSection, AnimatedItem } from "./AnimatedSection";

const benefits = [
  {
    icon: Smartphone,
    title: "Sin descargas",
    description: "Los empleados solo escanean un QR, no instalan nada.",
  },
  {
    icon: Calculator,
    title: "Cálculo automático",
    description: "Las horas y sueldos se calculan solos.",
  },
  {
    icon: FileSpreadsheet,
    title: "Reportes en un clic",
    description: "Exportá Excel o PDF al fin de mes.",
  },
  {
    icon: ThumbsUp,
    title: "Fácil de usar",
    description: "Pensado para dueños de negocio, no para contadores.",
  },
  {
    icon: Globe,
    title: "Acceso desde cualquier lugar",
    description: "Desde el celular, tablet o computadora.",
  },
  {
    icon: Headphones,
    title: "Soporte en español",
    description: "Atención real cuando la necesitás.",
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="py-16 md:py-[120px] bg-[#F8F9FA]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        <AnimatedSection className="text-center max-w-md mx-auto mb-14 md:mb-20">
          <h2
            className="text-[#1A1A1A]"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            Por qué eligen Panahon
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {benefits.map((benefit, i) => (
            <AnimatedItem
              key={benefit.title}
              delay={i * 0.1}
              className="p-6 md:p-8 rounded-xl bg-white"
            >
              <div className="w-10 h-10 rounded-lg bg-[#FFF4EC] flex items-center justify-center mb-4">
                <benefit.icon
                  className="w-5 h-5 text-[#F97316]"
                  strokeWidth={1.5}
                />
              </div>
              <h3
                className="text-[#1A1A1A] mb-2"
                style={{ fontSize: "1.0625rem", fontWeight: 600 }}
              >
                {benefit.title}
              </h3>
              <p
                className="text-[#1A1A1A]/55"
                style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
              >
                {benefit.description}
              </p>
            </AnimatedItem>
          ))}
        </div>
      </div>
    </section>
  );
}