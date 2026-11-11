import { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, FileText, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { getResumenPorRango, formatDecimalHours, getEmpresa, getRegistros, getFeriadosByRango } from "../../lib/api";
import { calcularImporteRegistro } from "../../lib/payroll";
import { ReporteEmpleadoModal } from "./ReporteEmpleadoModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const avatarColors = [
  "bg-orange-100 text-orange-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700", "bg-indigo-100 text-indigo-700",
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Helper to format date to YYYY-MM-DD
function formatToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to get first day of current month
function getFirstDayOfMonth(): string {
  const now = new Date();
  return formatToISO(new Date(now.getFullYear(), now.getMonth(), 1));
}

// Helper to get today
function getToday(): string {
  return formatToISO(new Date());
}

// Helper to format date for display DD/MM/YYYY
function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Helper to check if range is greater than 12 months
function isRangeGreaterThan12Months(desde: string, hasta: string): boolean {
  const fromDate = new Date(desde);
  const toDate = new Date(hasta);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 365;
}

export function ReportesPage() {
  const { admin } = useAuth();
  const empresaId = admin?.empresa_id || "";

  const [exporting, setExporting] = useState<string | null>(null);
  const [reporteEmpleado, setReporteEmpleado] = useState<{ id: string; nombre: string; tipoJornada: string; valorHora: number; valorJornada: number | null; sueldoMensual: number | null } | null>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [totals, setTotals] = useState({ totalHours: 0, totalPay: 0 });
  const [loading, setLoading] = useState(true);
  const [empresaNombre, setEmpresaNombre] = useState("Empresa");
  const [registrosDetalle, setRegistrosDetalle] = useState<any[]>([]);
  const [feriadosReporte, setFeriadosReporte] = useState<Map<string, number>>(new Map());
  const [showDetalle, setShowDetalle] = useState(false);

  // Date filter states
  const [desdeInput, setDesdeInput] = useState(getFirstDayOfMonth());
  const [hastaInput, setHastaInput] = useState(getToday());
  const [desdeFilter, setDesdeFilter] = useState(getFirstDayOfMonth());
  const [hastaFilter, setHastaFilter] = useState(getToday());
  const [dateError, setDateError] = useState("");
  const [dateWarning, setDateWarning] = useState("");

  // Cargar nombre de empresa
  useEffect(() => {
    if (!empresaId) return;
    getEmpresa(empresaId)
      .then((empresa) => setEmpresaNombre(empresa.nombre || "Empresa"))
      .catch((err) => console.error("[Reportes] Error cargando empresa:", err));
  }, [empresaId]);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [resumen, registros, feriadosData] = await Promise.all([
        getResumenPorRango(empresaId, desdeFilter, hastaFilter),
        getRegistros(empresaId, desdeFilter, hastaFilter, undefined),
        getFeriadosByRango(desdeFilter, hastaFilter).catch(() => []),
      ]);
      setSummary(resumen);
      setRegistrosDetalle(registros);
      setFeriadosReporte(new Map(feriadosData.map((f: any) => [f.fecha, f.multiplicador || 2])));
      const tH = resumen.reduce((s: number, r: any) => s + (r.horas_totales || 0), 0);
      const tP = resumen.reduce((s: number, r: any) => s + (r.total_a_pagar || 0), 0);
      setTotals({ totalHours: tH, totalPay: tP });
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, desdeFilter, hastaFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    // Clear previous errors
    setDateError("");
    setDateWarning("");

    // Validate dates
    if (desdeInput && hastaInput) {
      const fromDate = new Date(desdeInput);
      const toDate = new Date(hastaInput);

      if (fromDate > toDate) {
        setDateError("La fecha 'Desde' no puede ser posterior a 'Hasta'");
        return;
      }

      // Check if range is greater than 12 months
      if (isRangeGreaterThan12Months(desdeInput, hastaInput)) {
        setDateWarning("El rango seleccionado es mayor a un año. Puede demorar un poco.");
      }
    }

    // Apply filters
    setDesdeFilter(desdeInput || getFirstDayOfMonth());
    setHastaFilter(hastaInput || getToday());
  };

  const handleClear = () => {
    const firstDay = getFirstDayOfMonth();
    const today = getToday();
    setDesdeInput(firstDay);
    setHastaInput(today);
    setDesdeFilter(firstDay);
    setHastaFilter(today);
    setDateError("");
    setDateWarning("");
  };

  const isDefaultRange = desdeFilter === getFirstDayOfMonth() && hastaFilter === getToday();
  const hasActiveFilters = !isDefaultRange;

  // Returns the sueldo to display and whether it's a feriado-rate day.
  // Uses sueldo_dia from the DB (already has the multiplier); falls back to
  // horas × valor_hora_snapshot for legacy records that predate this column.
  function getDetallePago(r: any, feriados = feriadosReporte): { monto: number; esFeriado: boolean } {
    const empleado = summary.find((item: any) => item.empleado_id === r.empleado_id);
    const tipo_jornada = empleado?.tipo_jornada || r.empleados?.tipo_jornada || "por_hora";
    const monto = calcularImporteRegistro(r, {
      tipo_jornada,
      valor_hora: empleado?.valor_hora ?? r.valor_hora_snapshot ?? 0,
      valor_jornada: empleado?.valor_jornada ?? null,
      sueldo_base_mensual: empleado?.sueldo_base_mensual ?? null,
    }, feriados);
    return { monto, esFeriado: feriados.has(r.fecha) };
  }

  // Build a lookup map to know which employees are mensual (from summary or from registros join)
  const tipoJornadaMap = new Map(summary.map((e: any) => [e.empleado_id, e.tipo_jornada || "por_hora"]));

  const registrosOrdenados = registrosDetalle
    .filter((r) => r.hora_salida)
    .sort((a, b) => {
      const na = a.empleados?.nombre_completo || "";
      const nb = b.empleados?.nombre_completo || "";
      return na !== nb ? na.localeCompare(nb, "es") : a.fecha.localeCompare(b.fecha);
    });

  const exportarExcel = (
    registros: any[],
    feriados: Map<string, number>,
    nombreEmpresa: string,
    desde: string,
    hasta: string
  ) => {
    try {
      const escapeCSV = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

      const completados = [...registros]
        .filter((r) => r.hora_salida)
        .sort((a, b) => {
          const na = a.empleados?.nombre_completo || "";
          const nb = b.empleados?.nombre_completo || "";
          return na !== nb ? na.localeCompare(nb, "es") : a.fecha.localeCompare(b.fecha);
        });

      const encabezado = [
        `Reporte de período - ${nombreEmpresa}`,
        `Período: ${formatDisplayDate(desde)} al ${formatDisplayDate(hasta)}`,
        `Generado por Panahon`,
        ``,
      ].join("\n");

      const columnas = ["Empleado", "Fecha", "Horas Trabajadas", "Valor Hora", "Sueldo del Día", "Tipo de Jornada"];

      const filasCsv = completados.map((r) => {
        const { monto, esFeriado } = getDetallePago(r, feriados);
        const [year, month, day] = r.fecha.split("-");
        return [
          escapeCSV(r.empleados?.nombre_completo || ""),
          `${day}/${month}/${year}`,
          parseFloat(r.horas_totales || 0).toFixed(2),
          `$${(r.valor_hora_snapshot || 0).toLocaleString("es-AR")}`,
          `$${monto.toLocaleString("es-AR")}`,
          esFeriado ? `Feriado (×${feriados.get(r.fecha) || 2})` : "Normal",
        ].join(",");
      });

      const contenido = [encabezado, columnas.join(","), ...filasCsv].join("\n");
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + contenido], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Panahon_Reporte_${formatDisplayDate(desde)}_al_${formatDisplayDate(hasta)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[Reportes] Error al generar Excel:", error);
      alert("No se pudo generar el Excel. Intentá de nuevo.");
    }
  };

  const exportarPDF = (
    registros: any[],
    feriados: Map<string, number>,
    nombreEmpresa: string,
    desde: string,
    hasta: string
  ) => {
    try {
      const doc = new jsPDF();

      doc.setFillColor(249, 115, 22);
      doc.rect(0, 0, 210, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Panahon", 14, 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Sistema de Control Horario", 14, 22);

      doc.setTextColor(26, 26, 26);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Reporte de Periodo - ${nombreEmpresa}`, 14, 48);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`Periodo: ${formatDisplayDate(desde)} al ${formatDisplayDate(hasta)}`, 14, 55);
      doc.text(`Generado el: ${new Date().toLocaleDateString("es-AR")}`, 14, 61);

      const completados = [...registros]
        .filter((r) => r.hora_salida)
        .sort((a, b) => {
          const na = a.empleados?.nombre_completo || "";
          const nb = b.empleados?.nombre_completo || "";
          return na !== nb ? na.localeCompare(nb, "es") : a.fecha.localeCompare(b.fecha);
        });

      let hasAnyFeriado = false;

      const filas = completados.map((r) => {
        const { monto, esFeriado } = getDetallePago(r, feriados);
        if (esFeriado) hasAnyFeriado = true;
        const [year, month, day] = r.fecha.split("-");
        return [
          r.empleados?.nombre_completo || "",
          `${day}/${month}/${year}`,
          parseFloat(r.horas_totales || 0).toFixed(2) + " hs",
          "$" + (r.valor_hora_snapshot || 0).toLocaleString("es-AR"),
          "$" + monto.toLocaleString("es-AR") + (esFeriado ? " *" : ""),
        ];
      });

      autoTable(doc, {
        startY: 70,
        head: [["Empleado", "Fecha", "Horas", "Valor Hora", "Sueldo del Dia"]],
        body: filas,
        styles: { fontSize: 9, font: "helvetica", cellPadding: 3 },
        headStyles: {
          fillColor: [249, 115, 22],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: 14, right: 14 },
      });

      if (hasAnyFeriado) {
        const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(107, 114, 128);
        doc.text("* Incluye recargo por feriado nacional", 14, finalY + 8);
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.text(
          `Panahon - Reporte generado automaticamente - Pagina ${i} de ${pageCount}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`Panahon_Reporte_${formatDisplayDate(desde)}_al_${formatDisplayDate(hasta)}.pdf`);
    } catch (error) {
      console.error("[Reportes] Error al generar PDF:", error);
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    }
  };

  const handleExport = (type: string) => {
    // Never export while a new range is loading: that could pair the new dates
    // with the previous range's records.
    if (loading) return;
    setExporting(type);
    
    if (summary.length === 0 && registrosDetalle.length === 0) {
      setExporting(null);
      return;
    }

    if (!admin?.empresa_id) {
      console.error("[Reportes] No se encontró empresa_id");
      setExporting(null);
      return;
    }

    // Obtener nombre de la empresa del admin
    const nombreEmpresa = empresaNombre;

    if (type === "excel") {
      exportarExcel(registrosDetalle, feriadosReporte, nombreEmpresa, desdeFilter, hastaFilter);
    } else if (type === "pdf") {
      exportarPDF(registrosDetalle, feriadosReporte, nombreEmpresa, desdeFilter, hastaFilter);
    }

    setTimeout(() => setExporting(null), 1500);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1160px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
        <h1 className="text-[#1A1A1A]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Reportes</h1>
        
        {/* Export buttons - Desktop only */}
        <div className="hidden sm:flex flex-wrap items-center gap-3">
          <button onClick={() => handleExport("excel")} disabled={loading || summary.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors bg-white disabled:opacity-40" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            <FileSpreadsheet className="w-4 h-4" />{exporting === "excel" ? "Exportando..." : "Exportar Excel"}
          </button>
          <button onClick={() => handleExport("pdf")} disabled={loading || summary.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors bg-white disabled:opacity-40" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            <FileText className="w-4 h-4" />{exporting === "pdf" ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Date inputs - Desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[#1A1A1A]/60 whitespace-nowrap" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Desde:</label>
            <input
              type="date"
              value={desdeInput}
              onChange={(e) => setDesdeInput(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.875rem" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#1A1A1A]/60 whitespace-nowrap" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Hasta:</label>
            <input
              type="date"
              value={hastaInput}
              onChange={(e) => setHastaInput(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.875rem" }}
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors whitespace-nowrap"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            Buscar
          </button>
          {hasActiveFilters && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/70 hover:bg-gray-50 transition-colors whitespace-nowrap"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Date inputs - Mobile */}
        <div className="sm:hidden">
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Desde</label>
              <input
                type="date"
                value={desdeInput}
                onChange={(e) => setDesdeInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
                style={{ fontSize: "0.875rem" }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Hasta</label>
              <input
                type="date"
                value={hastaInput}
                onChange={(e) => setHastaInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
                style={{ fontSize: "0.875rem" }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors"
              style={{ fontSize: "0.875rem", fontWeight: 600 }}
            >
              Buscar
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/70 hover:bg-gray-50 transition-colors"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {dateError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-red-700" style={{ fontSize: "0.875rem" }}>{dateError}</span>
          </div>
        )}

        {/* Warning message */}
        {dateWarning && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-700" style={{ fontSize: "0.875rem" }}>{dateWarning}</span>
          </div>
        )}

        {/* Active range indicator */}
        {!isDefaultRange && (
          <div className="px-4 py-2 rounded-lg bg-[#FFF4EC] border border-[#F97316]/20">
            <span className="text-[#F97316]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Mostrando reporte del {formatDisplayDate(desdeFilter)} al {formatDisplayDate(hastaFilter)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          <span className="ml-3 text-[#1A1A1A]/50" style={{ fontSize: "0.875rem" }}>Cargando reporte...</span>
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-[#1A1A1A]" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>Sin datos</p>
          <p className="text-[#1A1A1A]/45 mt-1" style={{ fontSize: "0.875rem" }}>No hay registros en el período seleccionado.</p>
        </div>
      ) : (
        <>
          {/* Table - Desktop */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hidden md:block">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-[#1A1A1A]" style={{ fontSize: "1rem", fontWeight: 600 }}>
                Resumen del período — {formatDisplayDate(desdeFilter)} al {formatDisplayDate(hastaFilter)}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FA]">
                    <th className="text-left px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>EMPLEADO</th>
                    <th className="text-center px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>DÍAS ASISTIDOS</th>
                    <th className="text-center px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>HORAS TOTALES</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>TARIFA</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>TOTAL A PAGAR</th>
                    <th className="text-center px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((emp: any, i: number) => {
                    const esMensual = emp.tipo_jornada === "mensual";
                    const esJornada = emp.tipo_jornada === "jornada";
                    return (
                    <tr key={emp.empleado_id} className={`border-t border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`} style={{ height: 56 }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                            <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{getInitials(emp.nombre_completo)}</span>
                          </div>
                          <div>
                            <span className="text-[#1A1A1A]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>{emp.nombre_completo}</span>
                            {esMensual && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" style={{ fontSize: "0.65rem", fontWeight: 600 }}>Mensual</span>
                            )}
                            {esJornada && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" style={{ fontSize: "0.65rem", fontWeight: 600 }}>Por Jornada</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>{emp.dias_trabajados} días</td>
                      <td className="text-center px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>
                        {esMensual
                          ? <span className="text-[#1A1A1A]/35 italic">{formatDecimalHours(emp.horas_totales)}</span>
                          : esJornada
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>{emp.dias_trabajados} días</span>
                          : formatDecimalHours(emp.horas_totales)}
                      </td>
                      <td className="text-right px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>
                        {esMensual
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Sueldo fijo</span>
                          : esJornada
                          ? `$${(emp.valor_jornada || 0).toLocaleString("es-AR")}/día`
                          : `$${(emp.valor_hora || 0).toLocaleString("es-AR")}/h`}
                      </td>
                      <td className="text-right px-5 py-3 text-[#1A1A1A]" style={{ fontSize: "0.875rem", fontWeight: 600 }}>${(emp.total_a_pagar || 0).toLocaleString("es-AR")}</td>
                      <td className="text-center px-4 py-3">
                        <button
                          onClick={() => setReporteEmpleado({ id: emp.empleado_id, nombre: emp.nombre_completo, tipoJornada: emp.tipo_jornada || "por_hora", valorHora: emp.valor_hora || 0, valorJornada: emp.valor_jornada ?? null, sueldoMensual: emp.sueldo_base_mensual ?? null })}
                          title={`Descargar reporte de ${emp.nombre_completo}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#F97316]/30 text-[#F97316] hover:bg-[#FFF4EC] transition-colors"
                          style={{ fontSize: "0.75rem", fontWeight: 500 }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Reporte
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1A1A1A]/10 bg-[#FFF4EC]/50">
                    <td className="px-5 py-4 text-[#1A1A1A]" style={{ fontSize: "0.875rem", fontWeight: 700 }}>TOTAL</td>
                    <td className="text-center px-5 py-4 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>--</td>
                    <td className="text-center px-5 py-4 text-[#1A1A1A]" style={{ fontSize: "0.875rem", fontWeight: 700 }}>{formatDecimalHours(totals.totalHours)}</td>
                    <td className="text-right px-5 py-4 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>--</td>
                    <td className="text-right px-5 py-4 text-[#F97316]" style={{ fontSize: "1rem", fontWeight: 700 }}>${totals.totalPay.toLocaleString("es-AR")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cards - Mobile */}
          <div className="md:hidden">
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <p className="text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600 }}>TOTAL DEL PERÍODO</p>
              <p className="text-[#F97316] mt-1" style={{ fontSize: "1.75rem", fontWeight: 700 }}>${totals.totalPay.toLocaleString("es-AR")}</p>
              <p className="text-[#1A1A1A]/45 mt-0.5" style={{ fontSize: "0.8125rem" }}>{formatDecimalHours(totals.totalHours)} totales</p>
            </div>
            <div className="space-y-3">
              {summary.map((emp: any, i: number) => {
                const esMensual = emp.tipo_jornada === "mensual";
                const esJornada = emp.tipo_jornada === "jornada";
                return (
                <div key={emp.empleado_id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{getInitials(emp.nombre_completo)}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-[#1A1A1A]" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{emp.nombre_completo}</span>
                      {esMensual && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" style={{ fontSize: "0.65rem", fontWeight: 600 }}>Mensual</span>
                      )}
                      {esJornada && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" style={{ fontSize: "0.65rem", fontWeight: 600 }}>Por Jornada</span>
                      )}
                    </div>
                    <span className="text-[#F97316]" style={{ fontSize: "0.9375rem", fontWeight: 700 }}>${(emp.total_a_pagar || 0).toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-4 text-[#1A1A1A]/50" style={{ fontSize: "0.8125rem" }}>
                      <span>{emp.dias_trabajados} días</span>
                      {!esMensual && !esJornada && <span>{formatDecimalHours(emp.horas_totales)}</span>}
                      {esMensual
                        ? <span className="text-blue-500">Sueldo fijo</span>
                        : esJornada
                        ? <span className="text-emerald-600">${(emp.valor_jornada || 0).toLocaleString("es-AR")}/día</span>
                        : <span>${(emp.valor_hora || 0).toLocaleString("es-AR")}/h</span>}
                    </div>
                    <button
                      onClick={() => setReporteEmpleado({ id: emp.empleado_id, nombre: emp.nombre_completo, tipoJornada: emp.tipo_jornada || "por_hora", valorHora: emp.valor_hora || 0, valorJornada: emp.valor_jornada ?? null, sueldoMensual: emp.sueldo_base_mensual ?? null })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#F97316]/30 text-[#F97316] hover:bg-[#FFF4EC] transition-colors"
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Reporte
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* ═══ DETALLE DIARIO DE REGISTROS ═══ */}
          {registrosOrdenados.length > 0 && (
            <div className="mt-6">
              {/* Toggle header */}
              <button
                onClick={() => setShowDetalle((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <span className="text-[#1A1A1A]" style={{ fontSize: "1rem", fontWeight: 600 }}>
                  Detalle de registros
                  <span className="ml-2 text-[#1A1A1A]/40" style={{ fontSize: "0.8125rem", fontWeight: 400 }}>
                    ({registrosOrdenados.length} turnos)
                  </span>
                </span>
                {showDetalle
                  ? <ChevronUp className="w-4 h-4 text-[#1A1A1A]/40" />
                  : <ChevronDown className="w-4 h-4 text-[#1A1A1A]/40" />}
              </button>

              {showDetalle && (
                <>
                  {/* Desktop table */}
                  <div className="bg-white rounded-b-xl border border-t-0 border-gray-100 overflow-hidden hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8F9FA]">
                            <th className="text-left px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>EMPLEADO</th>
                            <th className="text-center px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>FECHA</th>
                            <th className="text-center px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>HORAS</th>
                            <th className="text-right px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>VALOR HORA</th>
                            <th className="text-right px-5 py-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>SUELDO DEL DÍA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosOrdenados.map((r: any, i: number) => {
                            const tipoJornada = tipoJornadaMap.get(r.empleado_id) || r.empleados?.tipo_jornada || "por_hora";
                            const esMensual = tipoJornada === "mensual";
                            const esJornada = tipoJornada === "jornada";
                            const { monto, esFeriado } = getDetallePago(r);
                            const [yr, mo, dy] = r.fecha.split("-");
                            const fechaDisplay = `${dy}/${mo}/${yr}`;
                            return (
                              <tr
                                key={r.id}
                                className={`border-t border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""} ${esFeriado && !esMensual && !esJornada ? "bg-orange-50/40" : ""}`}
                              >
                                <td className="px-5 py-3 text-[#1A1A1A]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                                  {r.empleados?.nombre_completo || "—"}
                                </td>
                                <td className="text-center px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>
                                  {fechaDisplay}
                                </td>
                                <td className="text-center px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>
                                  {formatDecimalHours(r.horas_totales)}
                                </td>
                                <td className="text-right px-5 py-3 text-[#1A1A1A]/70" style={{ fontSize: "0.875rem" }}>
                                  {esMensual
                                    ? <span className="text-[#1A1A1A]/35 italic">—</span>
                                    : esJornada
                                    ? <span className="text-[#1A1A1A]/35 italic">Jornada</span>
                                    : `$${(r.valor_hora_snapshot || 0).toLocaleString("es-AR")}/h`}
                                </td>
                                <td className="text-right px-5 py-3" style={{ fontSize: "0.875rem" }}>
                                  {esMensual ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Asistencia</span>
                                  ) : esJornada ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>${monto.toLocaleString("es-AR")}{esFeriado ? " · ×2" : ""}</span>
                                  ) : (
                                    <>
                                      <span className={esFeriado ? "text-[#F97316]" : "text-[#1A1A1A]"} style={{ fontWeight: esFeriado ? 700 : 600 }}>
                                        ${monto.toLocaleString("es-AR")}
                                      </span>
                                      {esFeriado && (
                                        <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-bold leading-none" style={{ fontSize: "0.625rem" }}>
                                          Feriado ×2
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden mt-2 space-y-2">
                    {registrosOrdenados.map((r: any) => {
                      const tipoJornada = tipoJornadaMap.get(r.empleado_id) || r.empleados?.tipo_jornada || "por_hora";
                      const esMensual = tipoJornada === "mensual";
                      const esJornada = tipoJornada === "jornada";
                      const { monto, esFeriado } = getDetallePago(r);
                      const [yr, mo, dy] = r.fecha.split("-");
                      const fechaDisplay = `${dy}/${mo}/${yr}`;
                      return (
                        <div
                          key={r.id}
                          className={`bg-white rounded-xl border p-4 ${esFeriado && !esMensual && !esJornada ? "border-orange-200 bg-orange-50/30" : "border-gray-100"}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-[#1A1A1A]" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                                {r.empleados?.nombre_completo || "—"}
                              </p>
                              <p className="text-[#1A1A1A]/45 mt-0.5" style={{ fontSize: "0.8125rem" }}>{fechaDisplay}</p>
                            </div>
                            <div className="text-right">
                              {esMensual ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Asistencia</span>
                              ) : esJornada ? (
                                <p className="text-emerald-600" style={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                                  ${monto.toLocaleString("es-AR")}{esFeriado ? " · ×2" : ""}
                                </p>
                              ) : (
                                <>
                                  <p className={esFeriado ? "text-[#F97316]" : "text-[#1A1A1A]"} style={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                                    ${monto.toLocaleString("es-AR")}
                                  </p>
                                  {esFeriado && (
                                    <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-bold leading-none" style={{ fontSize: "0.625rem" }}>
                                      Feriado ×2
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3 text-[#1A1A1A]/50" style={{ fontSize: "0.8125rem" }}>
                            <span>{formatDecimalHours(r.horas_totales)}</span>
                            {!esMensual && !esJornada && (
                              <>
                                <span>·</span>
                                <span>${(r.valor_hora_snapshot || 0).toLocaleString("es-AR")}/h</span>
                              </>
                            )}
                            {esJornada && <span className="text-emerald-600">· Jornada completa</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bottom export buttons (mobile) */}
          <div className="md:hidden flex gap-3 mt-6">
            <button onClick={() => handleExport("excel")} disabled={loading || summary.length === 0} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-emerald-200 text-emerald-700 bg-white disabled:opacity-40" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => handleExport("pdf")} disabled={loading || summary.length === 0} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-red-200 text-red-600 bg-white disabled:opacity-40" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </>
      )}
      {/* Reporte individual por empleado */}
      {reporteEmpleado && (
        <ReporteEmpleadoModal
          empleadoId={reporteEmpleado.id}
          empleadoNombre={reporteEmpleado.nombre}
          tipoJornada={reporteEmpleado.tipoJornada}
          valorHora={reporteEmpleado.valorHora}
          valorJornada={reporteEmpleado.valorJornada}
          sueldoMensual={reporteEmpleado.sueldoMensual}
          onClose={() => setReporteEmpleado(null)}
        />
      )}
    </div>
  );
}
