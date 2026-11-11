import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Pencil, Search, X,
  Loader2, ClipboardEdit, AlertTriangle, Trash2, History, CheckCircle,
} from "lucide-react";
import { CargaManualModal } from "./CargaManualModal";
import { EliminarRegistroModal } from "./EliminarRegistroModal";
import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { getRegistros, getRegistrosEliminados, getEmployees, getFeriadosByRango, formatTimeLocal } from "../../lib/api";
import { getFriendlyError } from "../../lib/errorUtils";
import { startOfWeek, addWeeks, subWeeks, isSameWeek, format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nombre_completo: string;
  jornada_horas?: number;
  activo?: boolean;
  valor_hora?: number;
}

interface MatrixRow {
  empleado: Employee;
  cells: Record<string, any[]>;
  totalHoras: number;
  hasAlerts: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getColorIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % AVATAR_COLORS.length;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatHoras(h: number): string {
  if (h === 0) return "—";
  const hs = Math.floor(h);
  const ms = Math.round((h - hs) * 60);
  return ms > 0 ? `${hs}h ${ms}m` : `${hs}h`;
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getWeekDates(base: Date): string[] {
  const monday = startOfWeek(base, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function buildMatrix(
  records: any[],
  employees: Employee[],
  weekDates: string[]
): MatrixRow[] {
  const byEmp: Record<string, Record<string, any[]>> = {};
  for (const rec of records) {
    if (!byEmp[rec.empleado_id]) byEmp[rec.empleado_id] = {};
    if (!byEmp[rec.empleado_id][rec.fecha]) byEmp[rec.empleado_id][rec.fecha] = [];
    byEmp[rec.empleado_id][rec.fecha].push(rec);
  }
  for (const empId of Object.keys(byEmp)) {
    for (const date of Object.keys(byEmp[empId])) {
      byEmp[empId][date].sort((a, b) =>
        (a.hora_entrada || "").localeCompare(b.hora_entrada || "")
      );
    }
  }

  return employees
    .filter((emp) => emp.activo !== false)
    .map((emp) => {
      const empRecs = byEmp[emp.id] || {};
      const cells: Record<string, any[]> = {};
      let totalHoras = 0;
      let hasAlerts = false;

      for (const date of weekDates) {
        cells[date] = empRecs[date] ?? [];
        for (const rec of cells[date]) {
          totalHoras += rec.horas_totales || 0;
          if (rec.sospechoso || !rec.hora_salida) hasAlerts = true;
        }
      }

      return { empleado: emp, cells, totalHoras, hasAlerts };
    })
    .sort((a, b) =>
      a.empleado.nombre_completo.localeCompare(b.empleado.nombre_completo, "es")
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RegistrosPage() {
  const { admin } = useAuth();
  const { isDark } = useTheme();
  const empresaId = admin?.empresa_id || "";

  // ── Data state ──
  const [records, setRecords]       = useState<any[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [feriadoSet, setFeriadoSet] = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(false);
  const [loadError, setLoadError]   = useState("");

  // ── View toggle ──
  const [view, setView] = useState<"activos" | "eliminados">("activos");

  // ── Deleted records history ──
  const [eliminados, setEliminados]         = useState<any[]>([]);
  const [loadingEliminados, setLoadingEliminados] = useState(false);
  const [loadErrorEliminados, setLoadErrorEliminados] = useState("");

  // ── Success toast ──
  const [successMsg, setSuccessMsg] = useState("");

  // ── Week navigation ──
  const [semanaBase, setSemanaBase] = useState(new Date());
  const esActual = isSameWeek(semanaBase, new Date(), { weekStartsOn: 1 });
  const weekDates = useMemo(() => getWeekDates(semanaBase), [semanaBase]);
  const fechaDesde = weekDates[0];
  const fechaHasta = weekDates[6];
  const todayStr = useMemo(localToday, []);

  // ── Filters ──
  const [busqueda, setBusqueda]       = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  // ── Carga Manual modal ──
  const [showCargaManual, setShowCargaManual] = useState(false);
  const [cargaInitial, setCargaInitial] = useState<{ empleadoId: string; fecha: string; record?: any } | null>(null);

  // ── Delete modal ──
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string; fecha: string; hora_entrada: string;
    hora_salida?: string | null; horas_totales?: number | null; empleadoNombre: string;
  } | null>(null);

  // ── Fade-out for deleted rows ──
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // ── Period label ──
  const periodoLabel = useMemo(() => {
    const lunes  = new Date(fechaDesde + "T12:00:00");
    const dom    = new Date(fechaHasta + "T12:00:00");
    const mesIni = format(lunes, "MMM", { locale: es });
    const mesFin = format(dom, "MMM", { locale: es });
    const diaIni = format(lunes, "d", { locale: es });
    const diaFin = format(dom, "d", { locale: es });
    const anio   = format(dom, "yyyy", { locale: es });
    if (mesIni === mesFin) return `${diaIni} – ${diaFin} ${mesFin} ${anio}`;
    return `${diaIni} ${mesIni} – ${diaFin} ${mesFin} ${anio}`;
  }, [fechaDesde, fechaHasta]);

  // ── Fetch employees once ──
  useEffect(() => {
    if (!empresaId) return;
    getEmployees(empresaId).then(setEmployees).catch(console.error);
  }, [empresaId]);

  // ── Fetch active records ──
  const fetchData = useCallback(async () => {
    if (!empresaId || !fechaDesde) return;
    setLoading(true);
    setLoadError("");
    try {
      const [recs, feriadosData] = await Promise.all([
        getRegistros(empresaId, fechaDesde, fechaHasta, undefined),
        getFeriadosByRango(fechaDesde, fechaHasta).catch(() => []),
      ]);
      setRecords(recs);
      setFeriadoSet(new Set(feriadosData.map((f: any) => f.fecha)));
    } catch (err) {
      console.error("[Registros] fetchData error:", err);
      setLoadError(getFriendlyError(err, "No pudimos cargar los registros. Actualizá la página e intentá nuevamente."));
    } finally {
      setLoading(false);
    }
  }, [empresaId, fechaDesde, fechaHasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch deleted records when tab selected ──
  const fetchEliminados = useCallback(async () => {
    if (!empresaId) return;
    setLoadingEliminados(true);
    setLoadErrorEliminados("");
    try {
      const data = await getRegistrosEliminados(empresaId);
      setEliminados(data);
    } catch (err) {
      console.error("[Registros] fetchEliminados error:", err);
      setLoadErrorEliminados(getFriendlyError(err, "No pudimos cargar el historial. Intentá nuevamente."));
    } finally {
      setLoadingEliminados(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (view === "eliminados") fetchEliminados();
  }, [view, fetchEliminados]);

  // ── Build + filter matrix ──
  const matrix = useMemo(
    () => buildMatrix(records, employees, weekDates),
    [records, employees, weekDates]
  );

  const filteredMatrix = useMemo(
    () =>
      matrix.filter((row) => {
        const matchSearch =
          !busqueda ||
          row.empleado.nombre_completo.toLowerCase().includes(busqueda.toLowerCase());
        const matchAlert = !soloAlertas || row.hasAlerts;
        return matchSearch && matchAlert;
      }),
    [matrix, busqueda, soloAlertas]
  );

  // ── Summary ──
  const resumen = useMemo(() => {
    const totalHoras   = matrix.reduce((s, r) => s + r.totalHoras, 0);
    const totalAlertas = matrix.filter((r) => r.hasAlerts).length;
    return { totalHoras, totalAlertas };
  }, [matrix]);

  // ── Handlers ──
  const handleCellClick = (empleadoId: string, fecha: string, cell?: any) => {
    setCargaInitial({ empleadoId, fecha, record: cell ?? undefined });
    setShowCargaManual(true);
  };

  const handleNewCarga = () => {
    setCargaInitial(null);
    setShowCargaManual(true);
  };

  const handleOpenDelete = (rec: any, empleadoNombre: string) => {
    setDeleteTarget({
      id: rec.id,
      fecha: rec.fecha,
      hora_entrada: rec.hora_entrada,
      hora_salida: rec.hora_salida,
      horas_totales: rec.horas_totales,
      empleadoNombre,
    });
  };

  const handleDeleteSuccess = (registroId: string) => {
    setDeleteTarget(null);
    // Fade out the chip, then refresh data
    setDeletedIds((prev) => new Set([...prev, registroId]));
    setSuccessMsg("Registro eliminado correctamente.");
    setTimeout(() => setSuccessMsg(""), 4000);
    setTimeout(() => {
      fetchData();
      setDeletedIds((prev) => { const s = new Set(prev); s.delete(registroId); return s; });
    }, 350);
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Registros
        </h1>
        {view === "activos" && (
          <button
            onClick={handleNewCarga}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors whitespace-nowrap"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            <ClipboardEdit className="w-4 h-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Carga Manual</span>
            <span className="sm:hidden">Manual</span>
          </button>
        )}
      </div>

      {/* ═══ VIEW TOGGLE ═══ */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setView("activos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            view === "activos"
              ? "bg-white dark:bg-zinc-900 text-[#1A1A1A] dark:text-zinc-100 shadow-sm"
              : "text-[#6B7280] dark:text-zinc-400 hover:text-[#1A1A1A] dark:hover:text-zinc-200"
          }`}
          style={{ fontSize: "0.875rem", fontWeight: view === "activos" ? 600 : 500 }}
        >
          <ClipboardEdit className="w-3.5 h-3.5" strokeWidth={1.75} />
          Registros activos
        </button>
        <button
          onClick={() => setView("eliminados")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            view === "eliminados"
              ? "bg-white dark:bg-zinc-900 text-[#1A1A1A] dark:text-zinc-100 shadow-sm"
              : "text-[#6B7280] dark:text-zinc-400 hover:text-[#1A1A1A] dark:hover:text-zinc-200"
          }`}
          style={{ fontSize: "0.875rem", fontWeight: view === "eliminados" ? 600 : 500 }}
        >
          <History className="w-3.5 h-3.5" strokeWidth={1.75} />
          Historial de eliminados
          {eliminados.length > 0 && view !== "eliminados" && (
            <span
              className="inline-flex items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
              style={{ fontSize: "0.6875rem", fontWeight: 700, minWidth: "18px", height: "18px", padding: "0 4px" }}
            >
              {eliminados.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══ GLOBAL MESSAGES ═══ */}
      {loadError && (
        <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" style={{ fontSize: "0.8125rem" }}>
          {loadError}
        </p>
      )}
      {successMsg && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 px-3 py-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-emerald-700 dark:text-emerald-300" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{successMsg}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW: REGISTROS ACTIVOS
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "activos" && (
        <>
          {/* ── CONTROLS ── */}
          <div className="flex flex-wrap gap-3 mb-5 items-center">
            {/* Week navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSemanaBase((p) => subWeeks(p, 1))}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4 text-[#1A1A1A] dark:text-zinc-300" />
              </button>

              <span
                className="px-3 text-[#1A1A1A] dark:text-zinc-100 text-center whitespace-nowrap"
                style={{ fontSize: "0.9375rem", fontWeight: 600, minWidth: "170px" }}
              >
                {periodoLabel}
              </span>

              <button
                onClick={() => setSemanaBase((p) => addWeeks(p, 1))}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                title="Semana siguiente"
              >
                <ChevronRight className="w-4 h-4 text-[#1A1A1A] dark:text-zinc-300" />
              </button>

              {!esActual && (
                <button
                  onClick={() => setSemanaBase(new Date())}
                  className="ml-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                  style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                >
                  Hoy
                </button>
              )}
            </div>

            <div className="flex-1 min-w-[8px]" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/35 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar empleado…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 pr-8 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/30 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-900 w-full sm:w-[220px]"
                style={{ fontSize: "0.875rem" }}
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Solo Alertas toggle */}
            <button
              onClick={() => setSoloAlertas((p) => !p)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border transition-colors select-none ${
                soloAlertas
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
              <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${soloAlertas ? "bg-amber-400" : "bg-gray-200 dark:bg-zinc-700"}`}>
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                  style={{ left: soloAlertas ? "18px" : "2px" }}
                />
              </div>
              <span className="whitespace-nowrap">
                Solo alertas
                {resumen.totalAlertas > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-200 text-amber-800"
                    style={{ fontSize: "0.6875rem", fontWeight: 700, width: "18px", height: "18px" }}
                  >
                    {resumen.totalAlertas}
                  </span>
                )}
              </span>
            </button>
          </div>

          {/* ── SUMMARY STRIP ── */}
          {!loading && records.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[#6B7280] dark:text-zinc-500" style={{ fontSize: "0.8125rem" }}>
              <span>{records.length} registro{records.length !== 1 ? "s" : ""} esta semana</span>
              <span>·</span>
              <span className="font-semibold text-[#1A1A1A] dark:text-zinc-100">{formatHoras(resumen.totalHoras)} totales</span>
              {resumen.totalAlertas > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {resumen.totalAlertas} empleado{resumen.totalAlertas !== 1 ? "s" : ""} con alertas
                  </span>
                </>
              )}
            </div>
          )}

          {/* ── WEEKLY MATRIX ── */}
          {loading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-14 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
              <span className="ml-3 text-[#1A1A1A]/50 dark:text-zinc-500" style={{ fontSize: "0.875rem" }}>
                Cargando registros…
              </span>
            </div>
          ) : (
            <div
              className="overflow-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200"
              style={{ maxHeight: "calc(100vh - 340px)" }}
            >
              <table className="w-full border-separate border-spacing-0" style={{ minWidth: "820px" }}>
                {/* ── THEAD ── */}
                <thead>
                  <tr>
                    <th
                      className="sticky top-0 left-0 z-40 bg-gray-50 dark:bg-zinc-800 border-b border-r border-gray-200 dark:border-zinc-700 text-left px-4 py-3"
                      style={{ minWidth: "200px", fontSize: "0.8125rem", fontWeight: 600, color: "#6B7280" }}
                    >
                      Empleado
                    </th>
                    {weekDates.map((date, i) => {
                      const isToday   = date === todayStr;
                      const isFeriado = feriadoSet.has(date);
                      const dayNum    = new Date(date + "T12:00:00").getDate();
                      return (
                        <th
                          key={date}
                          className={`sticky top-0 z-20 border-b border-r border-gray-200 dark:border-zinc-700 px-3 py-2.5 text-center whitespace-nowrap ${
                            isToday   ? "bg-orange-50 dark:bg-orange-950/40"
                            : isFeriado ? "bg-amber-50/60 dark:bg-amber-950/30"
                            : "bg-gray-50 dark:bg-zinc-800"
                          }`}
                          style={{ minWidth: "96px", fontSize: "0.8125rem", fontWeight: 600 }}
                        >
                          <span
                            className="block"
                            style={{ color: isToday ? "#F97316" : "#9CA3AF", fontSize: "0.75rem", fontWeight: 500, marginBottom: "1px" }}
                          >
                            {DAY_NAMES[i]}
                            {isFeriado && !isToday && (
                              <span className="ml-1 text-amber-400" style={{ fontSize: "0.6875rem" }}>★</span>
                            )}
                          </span>
                          <span
                            className={`block text-lg leading-none ${isToday ? "text-[#F97316]" : "text-[#1A1A1A] dark:text-zinc-100"}`}
                            style={{ fontWeight: 700 }}
                          >
                            {dayNum}
                          </span>
                        </th>
                      );
                    })}
                    <th
                      className="sticky top-0 z-20 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 py-3 text-center whitespace-nowrap"
                      style={{ minWidth: "80px", fontSize: "0.8125rem", fontWeight: 600, color: "#6B7280" }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>

                {/* ── TBODY ── */}
                <tbody>
                  {filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-14 text-center dark:text-zinc-500" style={{ fontSize: "0.9375rem", color: "#9CA3AF" }}>
                        {soloAlertas
                          ? "No hay empleados con alertas esta semana 🎉"
                          : busqueda
                          ? `Sin resultados para "${busqueda}"`
                          : "No hay empleados activos para mostrar"}
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((row, rowIdx) => {
                      const colorClass = AVATAR_COLORS[getColorIndex(row.empleado.nombre_completo)];
                      const initials   = getInitials(row.empleado.nombre_completo);
                      const rowBg      = isDark
                        ? (rowIdx % 2 === 1 ? "rgba(39,39,42,0.5)" : "#18181b")
                        : (rowIdx % 2 === 1 ? "rgba(249,250,251,0.6)" : "white");

                      return (
                        <tr key={row.empleado.id}>
                          {/* ── Employee cell ── */}
                          <td
                            className="sticky left-0 z-10 border-b border-r border-gray-100 dark:border-zinc-800 px-4 py-3"
                            style={{ backgroundColor: rowBg, boxShadow: "2px 0 6px -3px rgba(0,0,0,0.07)", minWidth: "200px" }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
                                style={{ fontSize: "0.6875rem", fontWeight: 700 }}
                              >
                                {initials}
                              </div>
                              <span
                                className="truncate text-[#1A1A1A] dark:text-zinc-100"
                                style={{ fontSize: "0.875rem", fontWeight: 500, maxWidth: "130px" }}
                                title={row.empleado.nombre_completo}
                              >
                                {row.empleado.nombre_completo}
                              </span>
                              {row.hasAlerts && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Tiene alertas" />
                              )}
                            </div>
                          </td>

                          {/* ── Day cells ── */}
                          {weekDates.map((date) => {
                            const cellRecords = row.cells[date];
                            const isEmpty     = cellRecords.length === 0;
                            const isToday     = date === todayStr;
                            const isFeriado   = feriadoSet.has(date);
                            const hasAbierto     = cellRecords.some((r) => !r.hora_salida);
                            const hasSospechoso  = cellRecords.some((r) => r.sospechoso);

                            let cellBg = isToday ? (isDark ? "rgba(249,115,22,0.08)" : "rgba(255,237,213,0.25)") : rowBg;
                            if (hasSospechoso)           cellBg = isDark ? "rgba(251,191,36,0.12)" : "rgba(253,230,138,0.35)";
                            else if (hasAbierto)         cellBg = isDark ? "rgba(239,68,68,0.12)" : "rgba(254,202,202,0.25)";
                            else if (isFeriado && !isEmpty) cellBg = isDark ? "rgba(251,191,36,0.08)" : "rgba(254,243,199,0.5)";

                            return (
                              <td
                                key={date}
                                className="border-b border-r border-gray-100 dark:border-zinc-800 px-1.5 py-1.5 text-center"
                                style={{ minWidth: "96px", backgroundColor: cellBg }}
                              >
                                {isEmpty ? (
                                  <button
                                    onClick={() => handleCellClick(row.empleado.id, date, undefined)}
                                    className="text-gray-300 dark:text-zinc-700 hover:text-[#F97316]/50 transition-colors w-full flex items-center justify-center py-1.5"
                                    style={{ fontSize: "1.125rem", lineHeight: 1, fontWeight: 300 }}
                                    title={`Agregar turno · ${row.empleado.nombre_completo} · ${date}`}
                                  >
                                    +
                                  </button>
                                ) : (
                                  <div className="flex flex-col">
                                    {cellRecords.map((rec, recIdx) => {
                                      const recAbierto    = !rec.hora_salida;
                                      const recSospechoso = rec.sospechoso;
                                      const recEditado    = rec.editado_manual;
                                      const horasColor    = recSospechoso ? "#B45309" : recAbierto ? "#DC2626" : (isDark ? "#e4e4e7" : "#1A1A1A");
                                      const isDeleting    = deletedIds.has(rec.id);

                                      return (
                                        <div
                                          key={rec.id}
                                          className={`relative group transition-opacity duration-300 ${isDeleting ? "opacity-0" : "opacity-100"} ${recIdx > 0 ? "border-t border-gray-100 dark:border-zinc-700" : ""}`}
                                        >
                                          {/* Clickable chip (edit) */}
                                          <div
                                            onClick={() => handleCellClick(row.empleado.id, date, rec)}
                                            title={`${row.empleado.nombre_completo} · ${date}${rec.nota_interna ? ` · ${rec.nota_interna}` : ""}`}
                                            className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-75 transition-opacity px-0.5 py-1.5 pr-4"
                                          >
                                            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: horasColor, lineHeight: 1.2 }}>
                                              {rec.horas_totales
                                                ? formatHoras(rec.horas_totales)
                                                : recAbierto && rec.hora_entrada
                                                ? formatTimeLocal(rec.hora_entrada)
                                                : "–"}
                                            </span>
                                            <div className="flex items-center justify-center gap-0.5 h-3">
                                              {recAbierto && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block flex-shrink-0" title="Jornada abierta" />
                                              )}
                                              {recSospechoso && (
                                                <span style={{ fontSize: "0.625rem", lineHeight: 1 }} title="Registro sospechoso">⚠️</span>
                                              )}
                                              {recEditado && !recAbierto && !recSospechoso && (
                                                <Pencil className="w-2 h-2 text-blue-400 flex-shrink-0" strokeWidth={2} />
                                              )}
                                              {isFeriado && (
                                                <span className="text-amber-500 font-bold flex-shrink-0" style={{ fontSize: "0.5625rem" }} title="Feriado">★</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Delete button — appears on group hover */}
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleOpenDelete(rec, row.empleado.nombre_completo); }}
                                            title="Eliminar registro"
                                            className="absolute top-1 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all text-[#9CA3AF] hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
                                          </button>
                                        </div>
                                      );
                                    })}

                                    {isFeriado && (
                                      <span
                                        className="inline-flex items-center self-center px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 font-bold leading-none mb-0.5"
                                        style={{ fontSize: "0.5rem" }}
                                        title="Jornada con recargo por feriado nacional"
                                      >
                                        Feriado ×2
                                      </span>
                                    )}

                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCellClick(row.empleado.id, date, undefined); }}
                                      className="text-gray-200 dark:text-zinc-800 hover:text-[#F97316]/50 transition-colors w-full border-t border-gray-100 dark:border-zinc-800 pt-0.5 pb-0.5 leading-none"
                                      style={{ fontSize: "0.875rem" }}
                                      title="Agregar otro turno"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* ── Total cell ── */}
                          <td
                            className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3 text-center"
                            style={{ minWidth: "80px", backgroundColor: rowBg }}
                          >
                            <span
                              className={row.totalHoras > 0 ? "dark:text-zinc-100" : "dark:text-zinc-700"}
                              style={{ fontSize: "0.875rem", fontWeight: row.totalHoras > 0 ? 700 : 400, color: row.totalHoras > 0 ? "#1A1A1A" : "#D1D5DB" }}
                            >
                              {row.totalHoras > 0 ? formatHoras(row.totalHoras) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── LEGEND ── */}
          {!loading && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 dark:text-zinc-500" style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Abierto / Incompleto
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: "0.8125rem" }}>⚠️</span>
                Sospechoso
              </div>
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-blue-400" />
                Editado manualmente
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold" style={{ fontSize: "0.8125rem" }}>★</span>
                Feriado
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 font-bold" style={{ fontSize: "0.5rem" }}>
                  Feriado ×2
                </span>
                Recargo por feriado
              </div>
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-3 h-3 text-[#9CA3AF]" strokeWidth={1.75} />
                Hover sobre turno para eliminar
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW: HISTORIAL DE ELIMINADOS
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "eliminados" && (
        <div>
          {loadErrorEliminados && (
            <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700" style={{ fontSize: "0.8125rem" }}>
              {loadErrorEliminados}
            </p>
          )}

          {loadingEliminados ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-14 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
              <span className="ml-3 text-[#1A1A1A]/50 dark:text-zinc-500" style={{ fontSize: "0.875rem" }}>
                Cargando historial…
              </span>
            </div>
          ) : eliminados.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-14 text-center">
              <p style={{ fontSize: "0.9375rem", color: "#9CA3AF" }}>No hay registros eliminados</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[#6B7280] dark:text-zinc-500" style={{ fontSize: "0.8125rem" }}>
                {eliminados.length} registro{eliminados.length !== 1 ? "s" : ""} eliminado{eliminados.length !== 1 ? "s" : ""}
              </p>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <table className="w-full border-separate border-spacing-0" style={{ minWidth: "700px" }}>
                  <thead>
                    <tr>
                      {["Empleado", "Fecha", "Horario original", "Horas", "Eliminado el", "Motivo"].map((h) => (
                        <th
                          key={h}
                          className="sticky top-0 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 py-3 text-left whitespace-nowrap"
                          style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#6B7280" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eliminados.map((rec, idx) => {
                      const empNombre = rec.empleados?.nombre_completo ?? "—";
                      const rowBg = isDark
                        ? (idx % 2 === 1 ? "rgba(39,39,42,0.5)" : "#18181b")
                        : (idx % 2 === 1 ? "#F9FAFB" : "white");
                      return (
                        <tr key={rec.id}>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3" style={{ backgroundColor: rowBg }}>
                            <span className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                              {empNombre}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3" style={{ backgroundColor: rowBg }}>
                            <span className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                              {formatFecha(rec.fecha)}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3" style={{ backgroundColor: rowBg }}>
                            <span className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                              {formatTimeLocal(rec.hora_entrada)}
                              {rec.hora_salida ? ` → ${formatTimeLocal(rec.hora_salida)}` : " (abierto)"}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3" style={{ backgroundColor: rowBg }}>
                            <span className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                              {rec.horas_totales ? formatHoras(rec.horas_totales) : "—"}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3 whitespace-nowrap" style={{ backgroundColor: rowBg }}>
                            <span className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.8125rem" }}>
                              {rec.eliminado_at ? formatDatetime(rec.eliminado_at) : "—"}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 dark:border-zinc-800 px-4 py-3" style={{ backgroundColor: rowBg, maxWidth: "260px" }}>
                            <span className="line-clamp-2 text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.8125rem" }} title={rec.motivo_eliminacion}>
                              {rec.motivo_eliminacion || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden flex flex-col gap-3">
                {eliminados.map((rec) => {
                  const empNombre = rec.empleados?.nombre_completo ?? "—";
                  return (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-[#F9FAFB] dark:bg-zinc-800/60 px-4 py-3.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{empNombre}</p>
                        <span
                          className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-500 dark:text-red-400"
                          style={{ fontSize: "0.6875rem", fontWeight: 600 }}
                        >
                          Eliminado
                        </span>
                      </div>
                      <p className="text-[#6B7280] dark:text-zinc-500" style={{ fontSize: "0.8125rem" }}>
                        {formatFecha(rec.fecha)} · {formatTimeLocal(rec.hora_entrada)}{rec.hora_salida ? ` → ${formatTimeLocal(rec.hora_salida)}` : ""}{rec.horas_totales ? ` · ${formatHoras(rec.horas_totales)}` : ""}
                      </p>
                      {rec.eliminado_at && (
                        <p className="text-[#9CA3AF] dark:text-zinc-600" style={{ fontSize: "0.75rem" }}>
                          Eliminado el {formatDatetime(rec.eliminado_at)}
                        </p>
                      )}
                      {rec.motivo_eliminacion && (
                        <p className="text-[#6B7280] dark:text-zinc-400 italic" style={{ fontSize: "0.8125rem", lineHeight: 1.4 }}>
                          "{rec.motivo_eliminacion}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      {showCargaManual && (
        <CargaManualModal
          key={cargaInitial ? `${cargaInitial.empleadoId}::${cargaInitial.fecha}::${cargaInitial.record?.id ?? "new"}` : "new"}
          employees={employees}
          initialEmpleadoId={cargaInitial?.empleadoId}
          initialFecha={cargaInitial?.fecha}
          initialRecord={cargaInitial?.record}
          onClose={() => { setShowCargaManual(false); setCargaInitial(null); }}
          onSuccess={fetchData}
        />
      )}

      {deleteTarget && (
        <EliminarRegistroModal
          registro={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
