import { Hourglass } from "lucide-react";
import { useNavigate } from "react-router";

interface TrialWarningBannerProps {
  diasRestantes: number;
}

/**
 * Sticky yellow banner shown when the trial period has 3 or fewer days left.
 * Render only when diasRestantes >= 0 && diasRestantes <= 3.
 */
export function TrialWarningBanner({ diasRestantes }: TrialWarningBannerProps) {
  const navigate = useNavigate();

  const label =
    diasRestantes === 0
      ? "menos de 1 día"
      : diasRestantes === 1
      ? "1 día"
      : `${diasRestantes} días`;

  return (
    <div
      className="sticky top-0 z-50 w-full flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        background: "#FEF08A",
        borderBottom: "1.5px solid #EAB308",
      }}
    >
      {/* Icon + text */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Hourglass
          className="w-4 h-4 shrink-0"
          style={{ color: "#92400E" }}
          strokeWidth={1.75}
        />
        <p className="leading-snug min-w-0" style={{ fontSize: "0.8125rem", color: "#78350F" }}>
          <span style={{ fontWeight: 700 }}>
            Tu prueba gratuita finaliza en {label}.
          </span>{" "}
          <span className="hidden sm:inline" style={{ fontWeight: 400 }}>
            Evitá interrupciones en el servicio añadiendo un método de pago.
          </span>
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => navigate("/admin/configuracion?seccion=suscripcion")}
        className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors"
        style={{
          background: "#92400E",
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#78350F")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#92400E")}
      >
        Actualizar plan
      </button>
    </div>
  );
}
