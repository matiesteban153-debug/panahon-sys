import { Check } from "lucide-react";
import { useNavigate } from "react-router";
import { AnimatedSection, AnimatedItem } from "./AnimatedSection";

const benefits = [
  { label: "Empleados ilimitados", bold: true },
  { label: "Registro de fichaje de entrada y salida", bold: false },
  { label: "Panel de control y reportes automáticos", bold: false },
  { label: "Soporte prioritario", bold: false },
];

export function Pricing() {
  const navigate = useNavigate();

  return (
    <section id="precios" className="py-16 md:py-[120px] bg-[#F8F9FA]">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* ── Left: copy ─────────────────────────────────────────────── */}
          <AnimatedSection className="flex-1 text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <span
              className="inline-block mb-4 px-3 py-1 rounded-full bg-[#FFF4EC] text-[#F97316]"
              style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em" }}
            >
              PRECIOS
            </span>
            <h2
              className="text-[#1A1A1A]"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Un plan único.{" "}
              <span className="text-[#F97316]">Sin sorpresas</span> ni límites.
            </h2>
            <p
              className="mt-5 text-[#1A1A1A]/55 max-w-md mx-auto lg:mx-0"
              style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
            >
              Olvidate de pagar por cada empleado nuevo. Escalá tu negocio con
              la tranquilidad de tener toda la gestión de horarios cubierta por
              una tarifa plana.
            </p>
            <p
              className="mt-6 text-[#1A1A1A]/35"
              style={{ fontSize: "0.8125rem" }}
            >
              Precios en pesos argentinos · Sin permanencia mínima
            </p>
          </AnimatedSection>

          {/* ── Right: pricing card ─────────────────────────────────────── */}
          <AnimatedItem delay={0.15} className="flex-shrink-0 w-full max-w-sm mx-auto lg:mx-0">
            <div
              className="relative bg-white rounded-2xl p-8"
              style={{
                border: "1.5px solid #F0F0F0",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 40px -8px rgba(0,0,0,0.08)",
              }}
            >
              {/* Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span
                  className="px-4 py-1.5 rounded-full text-white"
                  style={{
                    background: "linear-gradient(90deg, #F97316 0%, #FF5A00 100%)",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    whiteSpace: "nowrap",
                  }}
                >
                  PLAN INICIAL
                </span>
              </div>

              {/* Price */}
              <div className="mt-4 mb-7">
                <div className="flex items-end gap-2">
                  <span
                    className="text-[#1A1A1A] leading-none"
                    style={{
                      fontSize: "3.75rem",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    $30.000
                  </span>
                </div>
                <p
                  className="mt-1.5 text-[#1A1A1A]/40"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  ARS / mes
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-[#F0F0F0] mb-7" />

              {/* Benefits */}
              <ul className="space-y-4 mb-8">
                {benefits.map((b) => (
                  <li key={b.label} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "#FFF4EC" }}
                    >
                      <Check className="w-3 h-3 text-[#F97316]" strokeWidth={2.5} />
                    </span>
                    <span
                      className="text-[#1A1A1A]/75"
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: b.bold ? 700 : 400,
                        color: b.bold ? "#1A1A1A" : undefined,
                      }}
                    >
                      {b.label}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => navigate("/registro")}
                className="w-full py-4 rounded-xl text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "#FF5A00",
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  boxShadow: "0 4px 14px rgba(255,90,0,0.35)",
                }}
              >
                Comenzar ahora
              </button>

              <p
                className="text-center mt-4 text-[#1A1A1A]/35"
                style={{ fontSize: "0.75rem" }}
              >
                Sin tarjeta de crédito · Cancelá cuando quieras
              </p>
            </div>
          </AnimatedItem>

        </div>
      </div>
    </section>
  );
}
