import { useState, useCallback, useEffect } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatedSection, AnimatedItem } from "./AnimatedSection";

const testimonials = [
  {
    quote:
      "Antes perdía 2 horas al mes calculando sueldos. Ahora tardo 10 minutos.",
    name: "Martín G.",
    role: "Dueño de restaurant, CABA",
  },
  {
    quote: "Mis empleados lo entendieron solos. Eso ya me vendió.",
    name: "Claudia R.",
    role: "Empresa de limpieza, Córdoba",
  },
  {
    quote:
      "Empecé a ver exactamente cuánto me costaba cada día de trabajo.",
    name: "Diego M.",
    role: "Construcción, Rosario",
  },
];

function TestimonialCard({
  t,
}: {
  t: (typeof testimonials)[0];
}) {
  return (
    <div className="bg-white rounded-xl p-6 md:p-8 flex flex-col h-full">
      {/* Stars */}
      <div className="flex gap-0.5 mb-5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 text-amber-400 fill-amber-400"
          />
        ))}
      </div>

      {/* Quote icon */}
      <Quote
        className="w-8 h-8 text-[#F97316]/15 mb-3 -scale-x-100"
        strokeWidth={1.5}
      />

      {/* Quote text */}
      <p
        className="flex-1 text-[#1A1A1A]"
        style={{ fontSize: "1.0625rem", lineHeight: 1.7, fontWeight: 500 }}
      >
        "{t.quote}"
      </p>

      {/* Author */}
      <div className="mt-6 pt-5 border-t border-[#1A1A1A]/5">
        <p
          className="text-[#1A1A1A]"
          style={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {t.name}
        </p>
        <p
          className="text-[#1A1A1A]/45 mt-0.5"
          style={{ fontSize: "0.8125rem" }}
        >
          {t.role}
        </p>
      </div>
    </div>
  );
}

export function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    );
  }, []);

  // Auto-play carousel on mobile
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [autoPlay, next]);

  return (
    <section className="py-16 md:py-[120px] bg-[#F8F9FA]">
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
            Lo que dicen nuestros clientes
          </h2>
        </AnimatedSection>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <AnimatedItem key={t.name} delay={i * 0.15}>
              <TestimonialCard t={t} />
            </AnimatedItem>
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
              onTouchStart={() => setAutoPlay(false)}
            >
              {testimonials.map((t) => (
                <div key={t.name} className="w-full flex-shrink-0 px-1">
                  <TestimonialCard t={t} />
                </div>
              ))}
            </div>
          </div>

          {/* Carousel controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => {
                prev();
                setAutoPlay(false);
              }}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:border-[#1A1A1A]/30 transition-colors bg-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrent(i);
                    setAutoPlay(false);
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-6 h-2 bg-[#F97316]"
                      : "w-2 h-2 bg-[#1A1A1A]/15"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                next();
                setAutoPlay(false);
              }}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:border-[#1A1A1A]/30 transition-colors bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}