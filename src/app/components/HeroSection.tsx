import { Star, Clock, User, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

function PhoneMockup() {
  return (
    <div className="w-[260px] md:w-[280px] bg-white rounded-[28px] shadow-xl border border-gray-200 p-3 mx-auto">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-1 pb-2">
        <span style={{ fontSize: "0.75rem" }} className="text-[#1A1A1A]/60">
          9:41
        </span>
        <div className="flex gap-1 items-center">
          <div className="w-4 h-2 rounded-sm bg-[#1A1A1A]/40" />
        </div>
      </div>
      {/* Screen content */}
      <div className="bg-[#F8F9FA] rounded-[20px] px-5 py-6 flex flex-col items-center gap-5">
        <div className="w-10 h-10 rounded-full bg-[#FFF4EC] flex items-center justify-center">
          <User className="w-5 h-5 text-[#F97316]" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p
            style={{ fontSize: "0.8125rem" }}
            className="text-[#1A1A1A]/50"
          >
            Buenos días
          </p>
          <p
            style={{ fontSize: "1.0625rem", fontWeight: 600 }}
            className="text-[#1A1A1A] mt-1"
          >
            María González
          </p>
        </div>
        <div className="flex items-center gap-2 text-[#1A1A1A]/40">
          <Clock className="w-4 h-4" strokeWidth={1.5} />
          <span style={{ fontSize: "0.75rem" }}>Lun 23 Feb — 08:55</span>
        </div>
        <button
          className="w-full py-3 bg-[#F97316] text-white rounded-lg hover:bg-[#EA6C0A] transition-colors"
          style={{ fontSize: "0.875rem", fontWeight: 500 }}
        >
          Fichar entrada
        </button>
        <p
          style={{ fontSize: "0.6875rem" }}
          className="text-[#1A1A1A]/30"
        >
          Último fichaje: ayer 18:02 — Salida
        </p>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const barHeights = [40, 65, 55, 80, 70, 90, 60];
  const innerHeights = [56, 72, 48, 64, 80, 44, 68];

  return (
    <div className="w-[200px] md:w-[220px] bg-white rounded-xl shadow-lg border border-gray-200 p-4 -mt-16 md:-mt-20 ml-auto mr-4 relative z-10">
      <p
        style={{ fontSize: "0.6875rem", fontWeight: 600 }}
        className="text-[#1A1A1A]/50 uppercase tracking-wider"
      >
        Resumen mensual
      </p>
      <div className="mt-3 space-y-2.5">
        <div className="flex justify-between items-center">
          <span
            style={{ fontSize: "0.75rem" }}
            className="text-[#1A1A1A]/60"
          >
            Empleados activos
          </span>
          <span
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
            className="text-[#1A1A1A]"
          >
            12
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span
            style={{ fontSize: "0.75rem" }}
            className="text-[#1A1A1A]/60"
          >
            Horas totales
          </span>
          <span
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
            className="text-[#1A1A1A]"
          >
            1.248h
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span
            style={{ fontSize: "0.75rem" }}
            className="text-[#1A1A1A]/60"
          >
            Costo estimado
          </span>
          <span
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
            className="text-[#F97316]"
          >
            $2.4M
          </span>
        </div>
      </div>
      {/* Mini bar chart */}
      <div className="flex items-end gap-1.5 mt-4 h-10">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-[#F97316]/20"
            style={{ height: `${h}%` }}
          >
            <div
              className="w-full rounded-sm bg-[#F97316]"
              style={{ height: `${innerHeights[i]}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="pt-28 md:pt-36 pb-16 md:pb-24 bg-[#F8F9FA]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left content */}
          <motion.div
            className="flex-1 text-center lg:text-left max-w-xl lg:max-w-none"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1
              className="text-[#1A1A1A]"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              El control horario más simple para tu equipo
            </h1>
            <p
              className="mt-5 text-[#1A1A1A]/60 max-w-lg mx-auto lg:mx-0"
              style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
            >
              Tus empleados fichan con un QR desde el celular. Vos ves las horas
              y calculás sueldos automáticamente. Sin apps, sin complicaciones.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <button
                onClick={() => navigate("/registro")}
                className="px-7 py-3.5 bg-[#F97316] text-white rounded-md hover:bg-[#EA6C0A] transition-colors flex items-center gap-2"
                style={{ fontSize: "1rem", fontWeight: 500 }}
              >
                Quiero empezar
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/fichaje")}
                className="px-7 py-3.5 text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors"
                style={{ fontSize: "0.9375rem" }}
              >
                Ver demo
              </button>
            </div>
            {/* Social proof */}
            <div className="mt-8 flex items-center gap-3 justify-center lg:justify-start">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
              <span
                style={{ fontSize: "0.8125rem" }}
                className="text-[#1A1A1A]/50"
              >
                Más de 200 empresas ya lo usan
              </span>
            </div>
          </motion.div>

          {/* Right visual */}
          <motion.div
            className="flex-1 relative max-w-sm lg:max-w-md"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <PhoneMockup />
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}