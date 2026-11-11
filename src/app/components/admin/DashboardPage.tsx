import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Loader2, FlaskConical } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { useNavigate, useOutletContext } from "react-router";
import { useAuth } from "../../lib/auth-context";
import { getResumenPorRango, getEmployees, getEmpresa, formatDecimalHours, countSuspiciousRecords, countIncompleteRecords, getAlertasCount, isSessionExpiredError } from "../../lib/api";
import { isDemoUser } from "../../lib/demo";
import OnboardingChecklist from "./OnboardingChecklist";
import { Button } from "../ui/button";

interface OnboardingData {
  empresaId: string;
  geovallaCargada: boolean;
  empleadoCargado: boolean;
  planActivo: boolean;
  planLabel: string;
}

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const avatarColors = [
  "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400",
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const navigate = useNavigate();
  const { admin } = useAuth();
  const { terminosAceptados } = useOutletContext<{ terminosAceptados: boolean | null }>();
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [onboardingRetry, setOnboardingRetry] = useState(0);

  const [summary, setSummary] = useState<any[]>([]);
  const [totals, setTotals] = useState({ totalHours: 0, totalPay: 0 });
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suspiciousCount, setSuspiciousCount] = useState(0);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [alertasSeguridad, setAlertasSeguridad] = useState(0);

  const empresaId = admin?.empresa_id || "";

  useEffect(() => {
    if (!empresaId || isDemoUser(admin?.email)) return;
    let cancelled = false;
    let latestRequest = 0;
    const refreshOnboarding = async () => {
      const request = ++latestRequest;
      setOnboardingError(false);
      try {
        const [empresa, employees] = await Promise.all([getEmpresa(empresaId), getEmployees(empresaId)]);
        if (cancelled || request !== latestRequest) return;
        if (!empresa) throw new Error("Empresa no disponible");
        const validLocation = typeof empresa.latitud === "number" && Number.isFinite(empresa.latitud)
          && Math.abs(empresa.latitud) <= 90 && typeof empresa.longitud === "number"
          && Number.isFinite(empresa.longitud) && Math.abs(empresa.longitud) <= 180;
        setOnboarding({
          empresaId,
          geovallaCargada: validLocation && typeof empresa.radio_metros === "number"
            && Number.isFinite(empresa.radio_metros) && empresa.radio_metros > 0,
          empleadoCargado: employees.some((employee: { activo?: boolean }) => employee.activo !== false),
          planActivo: empresa.plan_activo === true || empresa.exento_pago === true,
          planLabel: empresa.exento_pago === true ? "Cuenta exenta de pago" : "Plan activo",
        });
      } catch (error) {
        if (cancelled || request !== latestRequest || isSessionExpiredError(error)) return;
        setOnboardingError(true);
        console.error("Error fetching onboarding data:", error);
      }
    };
    setOnboarding(null);
    refreshOnboarding();
    window.addEventListener("focus", refreshOnboarding);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOnboarding);
    };
  }, [empresaId, admin?.email, onboardingRetry]);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const firstDay = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      const lastDayNum = new Date(year, monthIndex + 1, 0).getDate();
      const lastDay = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
      const [resumen, emps] = await Promise.all([
        getResumenPorRango(empresaId, firstDay, lastDay),
        getEmployees(empresaId),
      ]);

      setSummary(resumen);
      setEmployeeCount(emps.filter((e: any) => e.activo !== false).length);

      const tHours = resumen.reduce((s: number, r: any) => s + (r.horas_totales || 0), 0);
      const tPay = resumen.reduce((s: number, r: any) => s + (r.total_a_pagar || 0), 0);
      setTotals({ totalHours: tHours, totalPay: tPay });

      const suspicious = await countSuspiciousRecords(empresaId, year, monthIndex + 1);
      setSuspiciousCount(suspicious);

      const incomplete = await countIncompleteRecords(empresaId);
      setIncompleteCount(incomplete);

      const alertas = await getAlertasCount().catch(() => 0);
      setAlertasSeguridad(alertas);
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, year, monthIndex]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (monthIndex === 0) { setMonthIndex(11); setYear(year - 1); }
    else setMonthIndex(monthIndex - 1);
  };
  const nextMonth = () => {
    if (monthIndex === 11) { setMonthIndex(0); setYear(year + 1); }
    else setMonthIndex(monthIndex + 1);
  };

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const isDemo = isDemoUser(admin?.email);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1160px]">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <FlaskConical className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
          <p className="text-indigo-700 dark:text-indigo-300" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            Estás en modo Demo. Los datos se reinician periódicamente.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-[#1A1A1A] dark:text-zinc-50" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 px-1">
            <button onClick={prevMonth} className="p-2 text-[#1A1A1A]/40 dark:text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-zinc-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 min-w-[120px] text-center text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              {months[monthIndex]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 text-[#1A1A1A]/40 dark:text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-zinc-100 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            disabled={loading || summary.length === 0}
            onClick={() => {
              const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
              const header = [esc("Empleado"), esc("Horas trabajadas"), esc("Tipo"), esc("Total a pagar")].join(",");
              const dataRows = summary.map((emp: any) => {
                const tipo =
                  emp.tipo_jornada === "mensual" ? "Mensual" :
                  emp.tipo_jornada === "jornada" ? "Por jornada" :
                  `$${emp.valor_hora ?? 0}/h`;
                return [
                  esc(emp.nombre_completo || ""),
                  esc(formatDecimalHours(emp.horas_totales || 0)),
                  esc(tipo),
                  esc(`$${(emp.total_a_pagar || 0).toFixed(2)}`),
                ].join(",");
              });
              const totalRow = [esc("TOTAL"), esc(formatDecimalHours(totals.totalHours)), esc(""), esc(`$${totals.totalPay.toFixed(2)}`)].join(",");
              const lines = [
                esc(`Resumen mensual - ${months[monthIndex]} ${year}`),
                "",
                header,
                ...dataRows,
                "",
                totalRow,
              ];
              const csv = "﻿" + lines.join("\r\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `panahon-${months[monthIndex].toLowerCase()}-${year}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A]/70 dark:text-zinc-400 hover:border-[#1A1A1A]/30 dark:hover:border-zinc-500 transition-colors bg-white dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            <Download className="w-4 h-4" />
            Exportar mes
          </button>
        </div>
      </div>

      {!isDemo && empresaId && (
        onboardingError ? (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-5 text-sm text-[#1A1A1A]/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <p>No pudimos verificar los primeros pasos de tu local.</p>
            <Button type="button" variant="outline" onClick={() => setOnboardingRetry((value) => value + 1)} className="rounded-lg border-gray-200 bg-white text-[#1A1A1A] hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">Reintentar</Button>
          </div>
        ) : onboarding?.empresaId === empresaId && terminosAceptados !== null ? (
          <OnboardingChecklist
            terminosAceptados={terminosAceptados}
            geovallaCargada={onboarding.geovallaCargada}
            empleadoCargado={onboarding.empleadoCargado}
            planActivo={onboarding.planActivo}
            planLabel={onboarding.planLabel}
            onConfigGPS={() => navigate("/admin/configuracion?seccion=geovalla")}
            onAddEmpleado={() => navigate("/admin/empleados")}
            onVerPlanes={() => navigate("/admin/configuracion?seccion=suscripcion")}
            onVerTerminos={() => navigate("/privacidad?tab=terminos")}
            hideWhenComplete
            className="mb-6 lg:mb-8"
          />
        ) : (
          <div role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-5 text-sm text-[#1A1A1A]/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" />Verificando primeros pasos…
          </div>
        )
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <MetricCard label="Total horas trabajadas" value={loading ? "..." : formatDecimalHours(totals.totalHours)} />
        <MetricCard label="Total a pagar" value={loading ? "..." : `$${totals.totalPay.toLocaleString("es-AR")}`} />
        <MetricCard label="Empleados activos" value={loading ? "..." : String(employeeCount)} />
        <MetricCard label="Días del período" value={`${daysInMonth} días`} />
      </div>

      {/* Unified notifications container */}
      {!loading && (alertasSeguridad > 0 || suspiciousCount > 0 || incompleteCount > 0) && (
        <div className="mb-6 lg:mb-8 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl px-4 py-3.5 divide-y divide-gray-100 dark:divide-zinc-800 transition-colors duration-200">
          {alertasSeguridad > 0 && (
            <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0" />
              <p className="flex-1 text-[#374151] dark:text-zinc-300" style={{ fontSize: "0.875rem" }}>
                <strong>{alertasSeguridad}</strong> {alertasSeguridad === 1 ? "alerta de seguridad sin revisar" : "alertas de seguridad sin revisar"}
              </p>
              <button
                onClick={() => navigate("/admin/alertas")}
                className="text-[#F97316] hover:underline whitespace-nowrap transition-colors"
                style={{ fontSize: "0.8125rem", fontWeight: 500 }}
              >
                Ver alertas →
              </button>
            </div>
          )}
          {suspiciousCount > 0 && (
            <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="flex-1 text-[#374151] dark:text-zinc-300" style={{ fontSize: "0.875rem" }}>
                <strong>{suspiciousCount}</strong> {suspiciousCount !== 1 ? "registros" : "registro"} con horas fuera de lo esperado este mes
              </p>
              <button
                onClick={() => navigate("/admin/registros")}
                className="text-[#F97316] hover:underline whitespace-nowrap transition-colors"
                style={{ fontSize: "0.8125rem", fontWeight: 500 }}
              >
                Revisar →
              </button>
            </div>
          )}
          {incompleteCount > 0 && (
            <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <p className="flex-1 text-[#374151] dark:text-zinc-300" style={{ fontSize: "0.875rem" }}>
                <strong>{incompleteCount}</strong> {incompleteCount !== 1 ? "registros incompletos" : "registro incompleto"} sin hora de salida
              </p>
              <button
                onClick={() => navigate("/admin/registros")}
                className="text-[#F97316] hover:underline whitespace-nowrap transition-colors"
                style={{ fontSize: "0.8125rem", fontWeight: 500 }}
              >
                Ver →
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          <span className="ml-3 text-[#1A1A1A]/50 dark:text-zinc-500" style={{ fontSize: "0.875rem" }}>Cargando resumen...</span>
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-12 text-center">
          <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>
            Sin registros este mes
          </p>
          <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-1" style={{ fontSize: "0.875rem" }}>
            Los fichajes de tus empleados aparecerán acá cuando empiecen a fichar.
          </p>
        </div>
      ) : (
        <>
          {/* Table - Desktop */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden hidden md:block transition-colors duration-200">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-[#1A1A1A] dark:text-zinc-50" style={{ fontSize: "1rem", fontWeight: 600 }}>
                Resumen por empleado
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FA] dark:bg-zinc-800/70">
                    <th className="text-left px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>EMPLEADO</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>HORAS</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>VALOR HORA</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>TOTAL A PAGAR</th>
                    <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((emp: any, i: number) => (
                    <tr key={emp.empleado_id} className={`border-t border-gray-50 dark:border-zinc-800 ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-zinc-800/30" : ""} hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors`} style={{ height: 56 }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                            <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{getInitials(emp.nombre_completo)}</span>
                          </div>
                          <span className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            {emp.nombre_completo}
                          </span>
                        </div>
                      </td>
                      <td className="text-right px-5 py-3 text-[#1A1A1A]/70 dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                        {formatDecimalHours(emp.horas_totales)}
                      </td>
                      <td className="text-right px-5 py-3 text-[#1A1A1A]/70 dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                        ${(emp.valor_hora || 0).toLocaleString("es-AR")}/h
                      </td>
                      <td className="text-right px-5 py-3 text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        ${(emp.total_a_pagar || 0).toLocaleString("es-AR")}
                      </td>
                      <td className="text-right px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate("/admin/registros")} className="p-2 text-[#1A1A1A]/30 dark:text-zinc-600 hover:text-[#F97316] rounded-lg hover:bg-[#FFF4EC] dark:hover:bg-orange-950/40 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => navigate("/admin/empleados")} className="p-2 text-[#1A1A1A]/30 dark:text-zinc-600 hover:text-[#F97316] rounded-lg hover:bg-[#FFF4EC] dark:hover:bg-orange-950/40 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800 text-[#1A1A1A]/40 dark:text-zinc-600" style={{ fontSize: "0.8125rem" }}>
              Mostrando {summary.length} de {employeeCount} empleados
            </div>
          </div>

          {/* Cards - Mobile */}
          <div className="md:hidden space-y-3">
            <h2 className="text-[#1A1A1A] dark:text-zinc-50 mb-3" style={{ fontSize: "1rem", fontWeight: 600 }}>
              Resumen por empleado
            </h2>
            {summary.map((emp: any, i: number) => (
              <div key={emp.empleado_id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{getInitials(emp.nombre_completo)}</span>
                  </div>
                  <span className="text-[#1A1A1A] dark:text-zinc-100 flex-1" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    {emp.nombre_completo}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[#1A1A1A]/40 dark:text-zinc-500" style={{ fontSize: "0.6875rem" }}>Horas</p>
                    <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{formatDecimalHours(emp.horas_totales)}</p>
                  </div>
                  <div>
                    <p className="text-[#1A1A1A]/40 dark:text-zinc-500" style={{ fontSize: "0.6875rem" }}>Valor hora</p>
                    <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 600 }}>${(emp.valor_hora || 0).toLocaleString("es-AR")}</p>
                  </div>
                  <div>
                    <p className="text-[#1A1A1A]/40 dark:text-zinc-500" style={{ fontSize: "0.6875rem" }}>Total</p>
                    <p className="text-[#F97316]" style={{ fontSize: "0.875rem", fontWeight: 700 }}>${(emp.total_a_pagar || 0).toLocaleString("es-AR")}</p>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-center text-[#1A1A1A]/35 dark:text-zinc-600" style={{ fontSize: "0.8125rem" }}>
              Mostrando {summary.length} de {employeeCount} empleados
            </p>
          </div>
        </>
      )}
    </div>
  );
}
