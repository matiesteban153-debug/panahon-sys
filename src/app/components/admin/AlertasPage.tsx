import { useState, useEffect, useCallback } from "react";
import { Shield, CheckCircle, Eye, Loader2, Smartphone } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../lib/auth-context";
import {
  getAlertas,
  getAlertasCount,
  marcarAlertaRevisada,
  marcarTodasRevisadas,
  AlertaSeguridad,
} from "../../lib/api";

// ─── Type metadata ────────────────────────────────────────────────────────────

const TIPO_META: Record<string, { label: string; color: string; dot: string }> = {
  dispositivo_no_reconocido: { label: "Dispositivo no reconocido", color: "#F59E0B", dot: "#F59E0B" },
  registro_sospechoso:       { label: "Registro sospechoso",       color: "#F97316", dot: "#F97316" },
  ubicacion_fuera_de_rango:  { label: "Fuera de rango",            color: "#EF4444", dot: "#EF4444" },
};

function tipoMeta(tipo: string) {
  return TIPO_META[tipo] ?? { label: tipo, color: "#9CA3AF", dot: "#9CA3AF" };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDateStr(iso: string) {
  // Extract the YYYY-MM-DD from a UTC timestamptz using local time
  return new Date(iso).toLocaleDateString("en-CA"); // "YYYY-MM-DD"
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function formatGroupLabel(dateStr: string) {
  const todayStr  = new Date().toLocaleDateString("en-CA");
  const yestDate  = new Date(Date.now() - 86_400_000);
  const yestStr   = yestDate.toLocaleDateString("en-CA");
  const [y, m, d] = dateStr.split("-");
  const readable  = `${d}/${m}/${y}`;
  if (dateStr === todayStr) return `Hoy, ${readable}`;
  if (dateStr === yestStr)  return `Ayer, ${readable}`;
  return readable;
}

function groupByDate(alertas: AlertaSeguridad[]) {
  const map: Record<string, AlertaSeguridad[]> = {};
  for (const a of alertas) {
    const key = localDateStr(a.created_at);
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ label: formatGroupLabel(date), items }));
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

type TipoFilter = "todos" | "dispositivo_no_reconocido" | "registro_sospechoso" | "ubicacion_fuera_de_rango";
type EstadoFilter = "sin_revisar" | "revisados" | "todos";

const TIPO_CHIPS: { value: TipoFilter; label: string }[] = [
  { value: "todos",                    label: "Todos" },
  { value: "dispositivo_no_reconocido", label: "Dispositivo" },
  { value: "registro_sospechoso",       label: "Sospechoso" },
  { value: "ubicacion_fuera_de_rango",  label: "Fuera de rango" },
];

const ESTADO_CHIPS: { value: EstadoFilter; label: string }[] = [
  { value: "sin_revisar", label: "Sin revisar" },
  { value: "revisados",   label: "Revisados" },
  { value: "todos",       label: "Todos" },
];

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap bg-[#F97316] border-[#F97316] text-white font-semibold"
          : "px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-700 text-[#374151] dark:text-zinc-300 font-normal"
      }
      style={{ fontSize: "0.8125rem" }}
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AlertasPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const empresaId = admin?.empresa_id || "";

  const [alertas, setAlertas]         = useState<AlertaSeguridad[]>([]);
  const [loading, setLoading]         = useState(true);
  const [marking, setMarking]         = useState<string | null>(null);
  const [markingAll, setMarkingAll]   = useState(false);
  const [tipoFilter, setTipoFilter]   = useState<TipoFilter>("todos");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("sin_revisar");

  const fetchAlertas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const revisadoParam =
        estadoFilter === "sin_revisar" ? false :
        estadoFilter === "revisados"   ? true  : null;
      const data = await getAlertas({
        tipo:     tipoFilter === "todos" ? undefined : tipoFilter,
        revisado: revisadoParam,
      });
      setAlertas(data);
    } catch (err) {
      console.error("Error fetching alertas:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, tipoFilter, estadoFilter]);

  useEffect(() => { fetchAlertas(); }, [fetchAlertas]);

  const handleRevisar = async (id: string) => {
    setMarking(id);
    try {
      await marcarAlertaRevisada(id);
      setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, revisado: true } : a));
    } catch (err) {
      console.error("Error marcando alerta:", err);
    } finally {
      setMarking(null);
    }
  };

  const handleRevisarTodas = async () => {
    setMarkingAll(true);
    try {
      await marcarTodasRevisadas();
      setAlertas((prev) => prev.map((a) => ({ ...a, revisado: true })));
    } catch (err) {
      console.error("Error marcando todas:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const hayPendientes = alertas.some((a) => !a.revisado);
  const groups = groupByDate(alertas);

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-zinc-950 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 lg:pb-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-[#F97316]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[#1A1A1A] dark:text-zinc-50" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                Alertas de seguridad
              </h1>
              <p className="text-[#1A1A1A]/50 dark:text-zinc-500" style={{ fontSize: "0.8125rem" }}>
                Eventos inusuales registrados durante el fichaje
              </p>
            </div>
          </div>
          {hayPendientes && (
            <button
              onClick={handleRevisarTodas}
              disabled={markingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-[#374151] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 flex-shrink-0"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              {markingAll
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle className="w-4 h-4 text-[#F97316]" strokeWidth={1.5} />}
              Marcar todos como revisados
            </button>
          )}
        </div>

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {TIPO_CHIPS.map((c) => (
              <Chip key={c.value} active={tipoFilter === c.value} onClick={() => setTipoFilter(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="w-px bg-gray-200 dark:bg-zinc-700 self-stretch hidden sm:block" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {ESTADO_CHIPS.map((c) => (
              <Chip key={c.value} active={estadoFilter === c.value} onClick={() => setEstadoFilter(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#F97316] animate-spin" />
          </div>
        ) : alertas.length === 0 ? (
          <EmptyState estadoFilter={estadoFilter} />
        ) : (
          <div className="space-y-6">
            {groups.map(({ label, items }) => (
              <section key={label}>
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-2 px-1">
                  <span
                    className="text-[#374151]/50 dark:text-zinc-500 uppercase tracking-wider"
                    style={{ fontSize: "0.6875rem", fontWeight: 600 }}
                  >
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
                </div>

                {/* Alert rows */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden divide-y divide-gray-50 dark:divide-zinc-800">
                  {items.map((alerta) => (
                    <AlertaRow
                      key={alerta.id}
                      alerta={alerta}
                      onRevisar={handleRevisar}
                      onVerRegistro={() =>
                        navigate(`/admin/registros?empleado=${alerta.empleado_id}&fecha=${alerta.created_at.slice(0, 10)}`)
                      }
                      marking={marking === alerta.id}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertaRow({
  alerta, onRevisar, onVerRegistro, marking,
}: {
  alerta: AlertaSeguridad;
  onRevisar: (id: string) => void;
  onVerRegistro: () => void;
  marking: boolean;
}) {
  const nombre  = alerta.empleados?.nombre_completo || "Empleado";
  const meta    = tipoMeta(alerta.tipo_evento);
  const hora    = formatTime(alerta.created_at);
  const revisado = alerta.revisado;

  return (
    <div
      className="group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/70 dark:hover:bg-zinc-800/50"
      style={{ opacity: revisado ? 0.55 : 1 }}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: "#FFF4EC", color: "#F97316", fontSize: "0.6875rem", fontWeight: 700 }}
      >
        {getInitials(nombre)}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[#1A1A1A] dark:text-zinc-50" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
            {nombre}
          </span>
          <span className="text-[#374151]/40 dark:text-zinc-600" style={{ fontSize: "0.8125rem" }}>·</span>
          <span className="text-[#374151]/50 dark:text-zinc-500" style={{ fontSize: "0.8125rem" }}>{hora}</span>

          {/* Tipo badge */}
          <span
            className="inline-flex items-center gap-1 ml-1"
            style={{ fontSize: "0.8125rem", fontWeight: 500, color: meta.color }}
          >
            {alerta.tipo_evento === "dispositivo_no_reconocido"
              ? <Smartphone className="w-3.5 h-3.5" strokeWidth={2} />
              : <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: meta.dot }} />
            }
            {meta.label}
          </span>
        </div>

        <p className="text-[#374151]/55 dark:text-zinc-500 mt-0.5 capitalize" style={{ fontSize: "0.8125rem" }}>
          {alerta.tipo_fichaje || "—"}
          {alerta.descripcion ? ` · ${alerta.descripcion}` : ""}
          {revisado && <span className="ml-2 text-emerald-600 font-medium">✓ Revisado</span>}
        </p>
      </div>

      {/* Actions — visible on hover (always on mobile) */}
      {!revisado && (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 sm:mt-0.5">
          <button
            onClick={() => onRevisar(alerta.id)}
            disabled={marking}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors disabled:opacity-50 text-xs font-medium"
          >
            {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Revisar
          </button>
          <button
            onClick={onVerRegistro}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#374151] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-xs font-medium"
          >
            <Eye className="w-3 h-3" />
            Ver
          </button>
        </div>
      )}
      {/* Mobile: always visible actions */}
      {!revisado && (
        <div className="flex items-center gap-1.5 sm:hidden flex-shrink-0 mt-0.5">
          <button
            onClick={() => onRevisar(alerta.id)}
            disabled={marking}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F97316] text-white transition-colors disabled:opacity-50 text-xs font-medium"
          >
            {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Revisar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ estadoFilter }: { estadoFilter: string }) {
  const ok = estadoFilter === "sin_revisar";
  return (
    <div
      className={
        ok
          ? "flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed bg-[#F0FDF4] dark:bg-emerald-950/30 border-[#86EFAC] dark:border-emerald-900"
          : "flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed bg-[#F9FAFB] dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800"
      }
    >
      <div
        className={
          ok
            ? "w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-[#DCFCE7] dark:bg-emerald-950/50"
            : "w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-[#F3F4F6] dark:bg-zinc-800"
        }
      >
        {ok
          ? <CheckCircle className="w-6 h-6 text-green-500" strokeWidth={1.5} />
          : <Shield className="w-6 h-6 text-gray-400" strokeWidth={1.5} />}
      </div>
      <p
        className={ok ? undefined : "dark:text-zinc-400"}
        style={{ fontSize: "0.9375rem", fontWeight: 600, color: ok ? "#166534" : "#374151" }}
      >
        {ok ? "Todo en orden" : "Sin alertas"}
      </p>
      <p
        className={ok ? "mt-1" : "mt-1 dark:text-zinc-400"}
        style={{ fontSize: "0.875rem", color: ok ? "#16A34A" : "#374151", opacity: 0.65 }}
      >
        {ok ? "No hay alertas pendientes de revisión." : "No hay alertas para los filtros seleccionados."}
      </p>
    </div>
  );
}
