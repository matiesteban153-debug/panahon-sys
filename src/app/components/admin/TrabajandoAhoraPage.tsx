import { useState, useEffect, useCallback } from "react";
import { Users, Clock, Loader2, Coffee, RefreshCw } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { getEmpleadosTrabajandoAhora } from "../../lib/api";

const avatarColors = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatHoraEntrada(ts: string): string {
  return new Date(ts).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function calcTiempoTrabajado(horaEntrada: string): {
  hours: number;
  minutes: number;
  totalHours: number;
  label: string;
} {
  const entrada = new Date(horaEntrada).getTime();
  const ahora = Date.now();
  const diffMs = ahora - entrada;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalHours = totalMinutes / 60;

  let label: string;
  if (hours === 0) {
    label = `${minutes}m`;
  } else if (minutes === 0) {
    label = `${hours}h`;
  } else {
    label = `${hours}h ${minutes}m`;
  }

  return { hours, minutes, totalHours, label };
}

function getAlertLevel(totalHours: number): "normal" | "warning" | "danger" {
  if (totalHours >= 12) return "danger";
  if (totalHours >= 8) return "warning";
  return "normal";
}

const alertStyles = {
  normal: {
    dot: "bg-emerald-500",
    border: "border-gray-100",
    bg: "",
    timeBg: "bg-emerald-50 text-emerald-700",
  },
  warning: {
    dot: "bg-amber-500",
    border: "border-amber-200",
    bg: "bg-amber-50/50",
    timeBg: "bg-amber-50 text-amber-700",
  },
  danger: {
    dot: "bg-red-500",
    border: "border-red-200",
    bg: "bg-red-50/50",
    timeBg: "bg-red-50 text-red-700",
  },
};

export function TrabajandoAhoraPage() {
  const { admin } = useAuth();
  const empresaId = admin?.empresa_id || "";

  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    try {
      const data = await getEmpleadosTrabajandoAhora(empresaId);
      setRegistros(data);
    } catch (err) {
      console.error("Error cargando empleados trabajando:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update elapsed time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const count = registros.length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[800px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1
            className="text-[#1A1A1A] flex items-center gap-2"
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
          >
            <Users className="w-6 h-6 text-[#F97316]" />
            Trabajando ahora
          </h1>
          <p
            className="text-[#1A1A1A]/50 mt-1"
            style={{ fontSize: "0.875rem" }}
          >
            Personas actualmente en jornada laboral
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-[#1A1A1A]/60 hover:border-[#F97316]/30 hover:text-[#F97316] transition-colors bg-white disabled:opacity-50"
          style={{ fontSize: "0.8125rem", fontWeight: 500 }}
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Counter badge */}
      {!loading && (
        <div className="mb-6">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              count > 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-[#1A1A1A]/50"
            }`}
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                count > 0 ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            {count} empleado{count !== 1 ? "s" : ""} trabajando
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          <span
            className="ml-3 text-[#1A1A1A]/50"
            style={{ fontSize: "0.875rem" }}
          >
            Cargando...
          </span>
        </div>
      ) : count === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
              <Coffee className="w-8 h-8 text-[#1A1A1A]/20" />
            </div>
          </div>
          <p
            className="text-[#1A1A1A]"
            style={{ fontSize: "1.0625rem", fontWeight: 600 }}
          >
            No hay empleados trabajando en este momento
          </p>
          <p
            className="text-[#1A1A1A]/45 mt-1"
            style={{ fontSize: "0.875rem" }}
          >
            Cuando alguien fiche entrada, aparecera aca.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((reg: any, i: number) => {
            const nombre =
              reg.empleados?.nombre_completo || "Empleado desconocido";
            const { label, totalHours } = calcTiempoTrabajado(
              reg.hora_entrada
            );
            const alert = getAlertLevel(totalHours);
            const styles = alertStyles[alert];
            const horaStr = formatHoraEntrada(reg.hora_entrada);

            return (
              <div
                key={reg.id}
                className={`bg-white rounded-xl border ${styles.border} ${styles.bg} p-4 transition-all`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar with pulse dot */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center ${
                        avatarColors[i % avatarColors.length]
                      }`}
                    >
                      <span
                        style={{ fontSize: "0.8125rem", fontWeight: 600 }}
                      >
                        {getInitials(nombre)}
                      </span>
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${styles.dot}`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[#1A1A1A] truncate"
                      style={{ fontSize: "0.9375rem", fontWeight: 600 }}
                    >
                      {nombre}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span
                        className="text-[#1A1A1A]/50 flex items-center gap-1"
                        style={{ fontSize: "0.8125rem" }}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Entro a las {horaStr}
                      </span>
                    </div>
                  </div>

                  {/* Time badge */}
                  <div
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg ${styles.timeBg}`}
                    style={{ fontSize: "0.875rem", fontWeight: 700 }}
                  >
                    {label}
                  </div>
                </div>

                {/* Alert message */}
                {alert === "warning" && (
                  <div
                    className="mt-3 pt-3 border-t border-amber-200/50 text-amber-700 flex items-center gap-1.5"
                    style={{ fontSize: "0.8125rem" }}
                  >
                    <span>Lleva mas de 8 horas trabajando</span>
                  </div>
                )}
                {alert === "danger" && (
                  <div
                    className="mt-3 pt-3 border-t border-red-200/50 text-red-700 flex items-center gap-1.5"
                    style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                  >
                    <span>Lleva mas de 12 horas — verificar turno</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {!loading && count > 0 && (
        <p
          className="text-center text-[#1A1A1A]/30 mt-6"
          style={{ fontSize: "0.75rem" }}
        >
          Se actualiza automaticamente cada 60 segundos
        </p>
      )}
    </div>
  );
}
