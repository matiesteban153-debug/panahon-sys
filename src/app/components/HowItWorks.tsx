import { UserPlus, QrCode, Clock } from "lucide-react";
import { AnimatedSection, AnimatedItem } from "./AnimatedSection";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Creá tu cuenta",
    description:
      "Registrate en 2 minutos y cargá la lista de tus empleados.",
  },
  {
    number: "02",
    icon: QrCode,
    title: "Generá tu QR",
    description:
      "Descargá tu código QR único e imprimilo en tu local o lugar de trabajo.",
  },
  {
    number: "03",
    icon: Clock,
    title: "Fichaje en tiempo real",
    description:
      "Tus empleados escanean el QR y vos ves todo desde el dashboard al instante.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-16 md:py-[120px] bg-white">
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
            Empezá en menos de 5 minutos
          </h2>
        </AnimatedSection>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-[52px] left-[20%] right-[20%] h-px bg-[#1A1A1A]/10" />

          {steps.map((step, i) => (
            <AnimatedItem
              key={step.number}
              delay={i * 0.15}
              className="flex flex-col items-center text-center relative"
            >
              {/* Number badge */}
              <div className="relative z-10 mb-5">
                <div className="w-[104px] h-[104px] rounded-2xl bg-[#F8F9FA] flex flex-col items-center justify-center gap-1">
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                    className="text-[#F97316]"
                  >
                    PASO
                  </span>
                  <span
                    style={{ fontSize: "1.75rem", fontWeight: 700 }}
                    className="text-[#1A1A1A]"
                  >
                    {step.number}
                  </span>
                </div>
              </div>
              {/* Icon */}
              <div className="w-11 h-11 rounded-lg bg-[#FFF4EC] flex items-center justify-center mb-4">
                <step.icon
                  className="w-5 h-5 text-[#F97316]"
                  strokeWidth={1.5}
                />
              </div>
              {/* Text */}
              <h3
                className="text-[#1A1A1A] mb-2"
                style={{ fontSize: "1.125rem", fontWeight: 600 }}
              >
                {step.title}
              </h3>
              <p
                className="text-[#1A1A1A]/55 max-w-[260px]"
                style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
              >
                {step.description}
              </p>
            </AnimatedItem>
          ))}
        </div>
      </div>
    </section>
  );
}