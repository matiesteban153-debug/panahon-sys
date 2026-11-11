import { useState } from "react";
import { X, FileText, FileSpreadsheet, Loader2, Check } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { getRegistros, getFeriadosByRango } from "../../lib/api";
import { calcularImporteRegistro, calcularPago } from "../../lib/payroll";
import type { ConfigPago } from "../../lib/payroll";
import { trackEvent } from "../../lib/telemetry";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  empleadoId: string;
  empleadoNombre: string;
  tipoJornada?: string;
  valorHora: number;
  valorJornada?: number | null;
  sueldoMensual?: number | null;
  onClose: () => void;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatHs(h: number): string {
  const hs = Math.floor(h);
  const ms = Math.round((h - hs) * 60);
  return ms > 0 ? `${hs} hs ${ms} min` : `${hs} hs`;
}

function toTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function fetchDatosEmpleado(
  empresaId: string,
  empleadoId: string,
  desde: string,
  hasta: string,
  incluirIncompletos: boolean,
  config: { tipoJornada: string; valorHora: number; valorJornada?: number | null; sueldoMensual?: number | null }
) {
  const [registros, feriados] = await Promise.all([
    getRegistros(empresaId, desde, hasta, empleadoId),
    getFeriadosByRango(desde, hasta),
  ]);
  const multiplicadoresFeriado = new Map(feriados.map((f) => [f.fecha, f.multiplicador || 2]));
  const filtrados = incluirIncompletos ? registros : registros.filter((r: any) => r.hora_salida);
  const pagoConfig: ConfigPago = {
    tipo_jornada: (config.tipoJornada || "por_hora") as any,
    valor_hora: config.valorHora,
    valor_jornada: config.valorJornada ?? null,
    sueldo_base_mensual: config.sueldoMensual ?? null,
  };
  const { horas_totales, dias_trabajados, total_a_pagar } = calcularPago(registros, pagoConfig, multiplicadoresFeriado);
  return {
    registros: filtrados,
    totalHoras: horas_totales,
    totalPagar: total_a_pagar,
    diasTrabajados: dias_trabajados,
    pagoConfig,
    multiplicadoresFeriado,
  };
}

function generarPDF(
  empleadoNombre: string,
  tipoJornada: string,
  valorHora: number,
  valorJornada: number | null | undefined,
  desde: string,
  hasta: string,
  incluirDetalle: boolean,
  registros: any[],
  totalHoras: number,
  totalPagar: number,
  diasTrabajados: number,
  pagoConfig: ConfigPago,
  multiplicadoresFeriado: Map<string, number>,
) {
  const esJornada = tipoJornada === "jornada";
  const doc = new jsPDF();

  // Header
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Panahon", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte individual de empleado", 14, 23);

  // Employee info
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(empleadoNombre, 14, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`Período: ${displayDate(desde)} al ${displayDate(hasta)}`, 14, 56);
  if (esJornada) {
    doc.text(`Valor jornada: $${(valorJornada || 0).toLocaleString("es-AR")}/día`, 14, 62);
  } else if (tipoJornada === "mensual") {
    doc.text(`Modalidad: Sueldo mensual fijo`, 14, 62);
  } else {
    doc.text(`Valor hora: $${valorHora.toLocaleString("es-AR")}`, 14, 62);
  }
  doc.text(`Generado el: ${new Date().toLocaleDateString("es-AR")}`, 14, 68);

  // Summary box
  doc.setFillColor(255, 244, 236);
  doc.rect(14, 74, 182, 22, "F");
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${diasTrabajados}`, 26, 83);
  if (esJornada) {
    doc.text(`${diasTrabajados} días`, 86, 83);
  } else {
    doc.text(`${totalHoras.toFixed(2)} hs`, 86, 83);
  }
  doc.text(`$${totalPagar.toLocaleString("es-AR")}`, 150, 83);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("días trabajados", 20, 90);
  doc.text(esJornada ? "días completos" : "horas totales", 80, 90);
  doc.text("total a pagar", 144, 90);

  if (incluirDetalle) {
    const completos = registros.filter((r) => r.hora_salida);
    const filas = completos.map((r) => [
      new Date(r.fecha + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "short", day: "2-digit", month: "2-digit",
      }),
      toTime(r.hora_entrada),
      toTime(r.hora_salida),
      parseFloat(r.horas_totales).toFixed(2) + " hs",
      "$" + calcularImporteRegistro(r, pagoConfig, multiplicadoresFeriado).toLocaleString("es-AR"),
      r.editado_manual ? "Editado" : r.sospechoso ? "Revisar" : "OK",
    ]);

    const incompletos = registros.filter((r) => !r.hora_salida);
    const filasInc = incompletos.map((r) => [
      new Date(r.fecha + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "short", day: "2-digit", month: "2-digit",
      }),
      toTime(r.hora_entrada),
      "—",
      "—",
      "—",
      "Abierto",
    ]);

    autoTable(doc, {
      startY: 102,
      head: [["Fecha", "Entrada", "Salida", "Horas", "Importe", "Estado"]],
      body: [...filas, ...filasInc],
      foot: [[
        `Total: ${diasTrabajados} días`, "", "",
        totalHoras.toFixed(2) + " hs",
        "$" + totalPagar.toLocaleString("es-AR"),
        "",
      ]],
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [244, 245, 247], textColor: [26, 26, 26], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "center", cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Panahon — Reporte de ${empleadoNombre} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  const safeName = empleadoNombre.replace(/\s+/g, "_");
  doc.save(`Panahon_${safeName}_${desde}_${hasta}.pdf`);
}

function generarExcel(
  empleadoNombre: string,
  tipoJornada: string,
  valorHora: number,
  valorJornada: number | null | undefined,
  desde: string,
  hasta: string,
  registros: any[],
  totalHoras: number,
  totalPagar: number,
  diasTrabajados: number,
  pagoConfig: ConfigPago,
  multiplicadoresFeriado: Map<string, number>,
) {
  const esJornada = tipoJornada === "jornada";
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const completos = registros.filter((r) => r.hora_salida);
  const incompletos = registros.filter((r) => !r.hora_salida);

  const tarifaLabel = esJornada
    ? `Valor jornada: $${(valorJornada || 0).toLocaleString("es-AR")}/día`
    : tipoJornada === "mensual"
    ? "Modalidad: Sueldo mensual fijo"
    : `Valor hora: $${valorHora.toLocaleString("es-AR")}`;

  const encabezado = [
    esc(`Reporte individual — ${empleadoNombre}`),
    esc(`Período: ${displayDate(desde)} al ${displayDate(hasta)}`),
    esc(tarifaLabel),
    esc("Generado por Panahon"),
    "",
  ].join("\n");

  const columnas = ["Fecha", "Entrada", "Salida", "Horas", "Importe", "Estado"].join(",");

  const filasCompletas = completos.map((r) => [
    displayDate(r.fecha),
    toTime(r.hora_entrada),
    toTime(r.hora_salida),
    parseFloat(r.horas_totales).toFixed(2),
    calcularImporteRegistro(r, pagoConfig, multiplicadoresFeriado).toFixed(2),
    r.editado_manual ? "Editado manualmente" : r.sospechoso ? "Revisar" : "Completo",
  ].join(","));

  const filasInc = incompletos.map((r) => [
    displayDate(r.fecha),
    toTime(r.hora_entrada),
    "—", "—", "—", "Abierto",
  ].join(","));

  const filaTotales = [
    `Total: ${diasTrabajados} días`, "", "",
    totalHoras.toFixed(2),
    totalPagar.toFixed(2),
    "",
  ].join(",");

  const contenido = [
    encabezado,
    columnas,
    ...filasCompletas,
    ...filasInc,
    filaTotales,
  ].join("\n");

  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = empleadoNombre.replace(/\s+/g, "_");
  link.download = `Panahon_${safeName}_${desde}_${hasta}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReporteEmpleadoModal({ empleadoId, empleadoNombre, tipoJornada = "por_hora", valorHora, valorJornada, sueldoMensual, onClose }: Props) {
  const { admin } = useAuth();
  const empresaId = admin?.empresa_id || "";

  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(lastOfMonth());
  const [incluirDetalle, setIncluirDetalle] = useState(true);
  const [incluirIncompletos, setIncluirIncompletos] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [done, setDone] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState("");

  const fechaInvalida = desde && hasta && desde > hasta;

  const handleExport = async (tipo: "pdf" | "excel") => {
    if (!empresaId || fechaInvalida) return;
    setError("");
    setExporting(tipo);
    try {
      const { registros, totalHoras, totalPagar, diasTrabajados, pagoConfig, multiplicadoresFeriado } = await fetchDatosEmpleado(
        empresaId, empleadoId, desde, hasta, incluirIncompletos,
        { tipoJornada, valorHora, valorJornada, sueldoMensual }
      );

      if (registros.length === 0) {
        setError("No hay registros en el período seleccionado.");
        setExporting(null);
        return;
      }

      if (tipo === "pdf") {
        generarPDF(empleadoNombre, tipoJornada, valorHora, valorJornada, desde, hasta, incluirDetalle, registros, totalHoras, totalPagar, diasTrabajados, pagoConfig, multiplicadoresFeriado);
      } else {
        generarExcel(empleadoNombre, tipoJornada, valorHora, valorJornada, desde, hasta, registros, totalHoras, totalPagar, diasTrabajados, pagoConfig, multiplicadoresFeriado);
      }

      trackEvent({
        evento: tipo === "pdf" ? "reporte_pdf_generado" : "reporte_excel_generado",
        empresa_id: empresaId,
        empleado_id: empleadoId,
        resultado: "ok",
        metadata: {
          desde,
          hasta,
          registros_count: registros.length,
          dias_trabajados: diasTrabajados,
          incluir_detalle: tipo === "pdf" ? incluirDetalle : undefined,
          incluir_incompletos: incluirIncompletos,
        },
      });

      setDone(tipo);
      setTimeout(() => setDone(null), 2500);
    } catch (err: any) {
      console.error("[ReporteEmpleado]", err);
      trackEvent({
        evento: tipo === "pdf" ? "reporte_pdf_generado" : "reporte_excel_generado",
        empresa_id: empresaId,
        empleado_id: empleadoId,
        resultado: "error",
        error_mensaje: err.message,
        metadata: { desde, hasta },
      });
      setError("No se pudo generar el reporte. Intentá de nuevo.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-zinc-900 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF4EC] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[#F97316]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[#1A1A1A] dark:text-zinc-50 leading-tight" style={{ fontSize: "1rem", fontWeight: 700 }}>
                Reporte de {empleadoNombre}
              </h2>
              <p className="text-[#1A1A1A]/45 dark:text-zinc-500 leading-tight" style={{ fontSize: "0.75rem" }}>
                Seleccioná el período y formato
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#1A1A1A]/35 hover:text-[#1A1A1A] hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 space-y-4">

          {/* Date range */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-2" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Período
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#1A1A1A]/40 dark:text-zinc-500 mb-1" style={{ fontSize: "0.75rem" }}>Desde</label>
                <input
                  type="date"
                  value={desde}
                  max={isoToday()}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                  style={{ fontSize: "0.875rem" }}
                />
              </div>
              <div>
                <label className="block text-[#1A1A1A]/40 dark:text-zinc-500 mb-1" style={{ fontSize: "0.75rem" }}>Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  max={isoToday()}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                  style={{ fontSize: "0.875rem" }}
                />
              </div>
            </div>
            {fechaInvalida && (
              <p className="mt-1.5 text-red-500" style={{ fontSize: "0.75rem" }}>
                La fecha Desde no puede ser posterior a Hasta.
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setIncluirDetalle((v) => !v)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  incluirDetalle ? "bg-[#F97316] border-[#F97316]" : "border-gray-300 dark:border-zinc-600"
                }`}
              >
                {incluirDetalle && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[#1A1A1A] dark:text-zinc-200 select-none" style={{ fontSize: "0.875rem" }}>
                Incluir detalle día a día
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setIncluirIncompletos((v) => !v)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  incluirIncompletos ? "bg-[#F97316] border-[#F97316]" : "border-gray-300 dark:border-zinc-600"
                }`}
              >
                {incluirIncompletos && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[#1A1A1A] dark:text-zinc-200 select-none" style={{ fontSize: "0.875rem" }}>
                Incluir registros incompletos
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500" style={{ fontSize: "0.8125rem" }}>{error}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ fontSize: "0.9375rem", fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExport("pdf")}
                disabled={!!exporting || !!fechaInvalida}
                className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ fontSize: "0.9375rem", fontWeight: 500 }}
                title={`Descargar reporte PDF de ${empleadoNombre}`}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : done === "pdf" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {exporting === "pdf" ? "Generando…" : done === "pdf" ? "Descargado" : "PDF"}
              </button>
            </div>
            <button
              onClick={() => handleExport("excel")}
              disabled={!!exporting || !!fechaInvalida}
              className="w-full py-2.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: "0.9375rem", fontWeight: 500 }}
              title={`Descargar reporte Excel de ${empleadoNombre}`}
            >
              {exporting === "excel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : done === "excel" ? (
                <Check className="w-4 h-4" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {exporting === "excel" ? "Generando…" : done === "excel" ? "Descargado" : "Excel (CSV)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
