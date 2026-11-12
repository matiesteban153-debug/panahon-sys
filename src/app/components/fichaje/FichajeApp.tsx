import { useState, useCallback, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { SelectionScreen } from "./SelectionScreen";
import { ActionScreen } from "./ActionScreen";
import { ConfirmationScreen } from "./ConfirmationScreen";
import { ErrorScreen } from "./ErrorScreen";
import type { Employee, GeoLocation } from "./types";
import {
  getEmpleadosPorQR,
  getEstadoEmpleado,
  getEmpresaByQRToken,
  ficharEntrada,
  ficharSalida,
  verificarEstadoEmpresaEmpleado,
  PLAN_VENCIDO_DEFAULT_MSG,
  formatDecimalHours,
  formatTimeLocal,
} from "../../lib/api";
import { trackFichajeEvento, PULSE_SESSION_ID } from "../../lib/fichaje-pulse";
import { getFriendlyError } from "../../lib/errorUtils";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "../ui/alert-dialog";

const TURNO_ABIERTO_MSG = "Tenés un turno abierto sin cerrar. Debes registrar tu salida anterior o avisarle al administrador para que regularice tu asistencia";

// ─── Safe URL parser (no React Router hooks needed) ──────────────────────────
function getQrToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("empresa") || params.get("token") || "";
  } catch {
    return "";
  }
}

// ─── Inline splash — pure CSS, zero external dependencies ────────────────────
function FichajeSplash({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#F97316",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        transition: "opacity 0.45s ease",
      }}
    >
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "white", letterSpacing: "-0.03em" }}>
        Panahon
      </div>
      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.2em", marginTop: 4 }}>
        CONTROL HORARIO
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen =
  | { type: "selection" }
  | { type: "action"; employee: Employee }
  | { type: "confirm-entry"; employee: Employee; time: string }
  | { type: "confirm-exit"; employee: Employee; time: string; hoursWorked: string }
  | { type: "error"; message: string }
  | { type: "loading" };

// ─── Component ────────────────────────────────────────────────────────────────
export function FichajeApp() {
  console.log("-> Iniciando FichajeApp");

  // Safe token read — never throws, never requires router context
  const qrToken = getQrToken();

  const [companyName, setCompanyName] = useState("Cargando...");
  const [empresaId,   setEmpresaId]   = useState<string | null>(null);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [screen,      setScreen]      = useState<Screen>({ type: "loading" });
  const [splashVisible, setSplashVisible] = useState(true);
  const [planVencidoModalMsg, setPlanVencidoModalMsg] = useState<string | null>(null);
  const [turnoAbiertoModal, setTurnoAbiertoModal] = useState(false);
  const selectingRef = useRef(false);

  const minTimeElapsed = useRef(false);
  const dataReadyRef   = useRef(false);

  const tryDismissSplash = useCallback(() => {
    if (minTimeElapsed.current && dataReadyRef.current) {
      setSplashVisible(false);
    }
  }, []);

  // Track QR page open on mount
  useEffect(() => {
    trackFichajeEvento({
      evento: "qr_abierto",
      metadata: { qr_token_presente: !!qrToken },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minimum splash duration: 2.2 s
  useEffect(() => {
    const t = setTimeout(() => {
      minTimeElapsed.current = true;
      tryDismissSplash();
    }, 2200);
    return () => clearTimeout(t);
  }, [tryDismissSplash]);

  // Load employees
  useEffect(() => {
    console.log("[Fichaje] useEffect: qrToken =", qrToken || "(vacío)");

    if (!qrToken) {
      trackFichajeEvento({
        evento: "pagina_cargada",
        resultado: "error",
        error_codigo: "qr_token_ausente",
        error_mensaje: "Link inválido: no se encontró token de empresa",
      });
      setScreen({ type: "error", message: "Link inválido. No se encontró la empresa." });
      dataReadyRef.current = true;
      tryDismissSplash();
      return;
    }

    async function load() {
      try {
        console.log("[Fichaje] Llamando getEmpleadosPorQR...");
        const empList = await getEmpleadosPorQR(qrToken);
        console.log("[Fichaje] Empleados cargados:", empList?.length ?? 0);

        if (!empList || empList.length === 0) {
          trackFichajeEvento({
            evento: "pagina_cargada",
            resultado: "error",
            error_codigo: "sin_empleados",
            error_mensaje: "No se encontraron empleados para este QR",
            metadata: { qr_token_presente: !!qrToken },
          });
          setScreen({ type: "error", message: "No se encontraron empleados para este código QR." });
          dataReadyRef.current = true;
          tryDismissSplash();
          return;
        }

        let resolvedEmpresaId: string | null = null;
        try {
          const empresa = await getEmpresaByQRToken(qrToken);
          setCompanyName(empresa?.nombre || "Mi Empresa");
          resolvedEmpresaId = empresa?.id ?? null;
          setEmpresaId(resolvedEmpresaId);
        } catch (e) {
          console.warn("[Fichaje] No se pudo obtener nombre de empresa:", e);
          setCompanyName("Mi Empresa");
        }

        const employeesWithStatus: Employee[] = await Promise.all(
          empList.map(async (e: any) => {
            try {
              const estado = await getEstadoEmpleado(qrToken, e.id);
              return {
                id: e.id,
                name: e.nombre_completo,
                entryTime: estado?.hora_entrada ? formatTimeLocal(estado.hora_entrada) : null,
                estado: estado?.estado || "sin_fichaje",
              };
            } catch {
              return { id: e.id, name: e.nombre_completo, entryTime: null, estado: "sin_fichaje" };
            }
          })
        );

        console.log("[Fichaje] Empleados con estado listos:", employeesWithStatus.length);
        setEmployees(employeesWithStatus);
        setScreen({ type: "selection" });

        trackFichajeEvento({
          evento: "pagina_cargada",
          empresa_id: resolvedEmpresaId,
          resultado: "ok",
          metadata: { empleados_count: employeesWithStatus.length },
        });
      } catch (err: any) {
        console.error("[Fichaje] Error cargando datos:", err);
        trackFichajeEvento({
          evento: "pagina_cargada",
          resultado: "error",
          error_codigo: "fetch_error",
          error_mensaje: err?.message,
        });
        setScreen({ type: "error", message: getFriendlyError(err, "No pudimos cargar los datos del código QR. Verificá el enlace e intentá nuevamente.") });
      } finally {
        dataReadyRef.current = true;
        tryDismissSplash();
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(async (employee: Employee) => {
    if (selectingRef.current) return;
    selectingRef.current = true;
    trackFichajeEvento({
      evento: "empleado_seleccionado",
      empresa_id: empresaId,
      empleado_id: employee.id,
      metadata: { estado_previo: employee.estado },
    });
    try {
      const estado = await getEstadoEmpleado(qrToken, employee.id);
      if (!estado) throw new Error("No pudimos verificar tu turno. Volvé a seleccionar tu nombre para reintentar.");
      const updated: Employee = {
        ...employee,
        registroId: estado.registro_id ?? null,
        entryTime: estado?.hora_entrada ? formatTimeLocal(estado.hora_entrada) : null,
        estado: estado?.estado || "sin_fichaje",
      };
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setScreen({ type: "action", employee: updated });
      if (estado.estado === "en_jornada" && estado.hora_entrada &&
          new Date(estado.hora_entrada).toLocaleDateString("es-AR") !== new Date().toLocaleDateString("es-AR")) {
        setTurnoAbiertoModal(true);
      }
    } catch {
      setScreen({ type: "error", message: "No pudimos verificar si tenés un turno abierto. Volvé a seleccionar tu nombre para reintentar." });
    } finally {
      selectingRef.current = false;
    }
  }, [qrToken, empresaId]);

  const verifySubscriptionForEmployee = useCallback(async (empleadoId: string): Promise<boolean> => {
    const estadoSub = await verificarEstadoEmpresaEmpleado(empleadoId);
    if (!estadoSub.valido) {
      setPlanVencidoModalMsg(estadoSub.mensaje || PLAN_VENCIDO_DEFAULT_MSG);
      return false;
    }
    return true;
  }, []);

  const handleClockIn = useCallback(async (employee: Employee, location: GeoLocation | null, deviceId: string, biometricProof?: string) => {
    const subOk = await verifySubscriptionForEmployee(employee.id);
    if (!subOk) return;

    if (employee.estado === "en_jornada") {
      setTurnoAbiertoModal(true);
      return;
    }
    if (employee.estado === "jornada_completa") {
      setScreen({
        type: "error",
        message: employee.estado === "jornada_completa"
          ? "Ya completaste tu jornada hoy"
          : "Ya registraste tu entrada hoy",
      });
      return;
    }

    trackFichajeEvento({
      evento: "entrada_intentada",
      empresa_id: empresaId,
      empleado_id: employee.id,
      metadata: {
        gps_disponible: !!location,
        gps_precision_m: location?.accuracy ?? null,
        device_id_presente: !!deviceId,
      },
    });

    try {
      const estado = await getEstadoEmpleado(qrToken, employee.id);
      if (!estado) throw new Error("No pudimos verificar tu turno. Intentá nuevamente.");
      if (estado.estado === "en_jornada") {
        const updated = { ...employee, estado: "en_jornada" as const, registroId: estado.registro_id, entryTime: estado.hora_entrada ? formatTimeLocal(estado.hora_entrada) : null };
        setEmployees((prev) => prev.map((item) => item.id === employee.id ? updated : item));
        setScreen({ type: "action", employee: updated });
        setTurnoAbiertoModal(true);
        return;
      }
      const result = await ficharEntrada(qrToken, employee.id, location, deviceId, biometricProof);
      if (result?.success === false) {
        if (result.codigo === "TURNO_ABIERTO") {
          await handleSelect(employee);
          setTurnoAbiertoModal(true);
          return;
        }
        if (result.codigo === "PLAN_VENCIDO" || result.error === PLAN_VENCIDO_DEFAULT_MSG) {
          setPlanVencidoModalMsg(result.error || PLAN_VENCIDO_DEFAULT_MSG);
          return;
        }
        const esGeofence = result.error?.toLowerCase().includes("rango") || result.error?.toLowerCase().includes("geovalla");
        trackFichajeEvento({
          evento: esGeofence ? "gps_fuera_de_rango" : "entrada_fallida",
          empresa_id: empresaId,
          empleado_id: employee.id,
          resultado: "error",
          error_mensaje: result.error,
          metadata: {
            gps_precision_m: location?.accuracy ?? null,
            gps_lat: location?.latitude ?? null,
            gps_lng: location?.longitude ?? null,
          },
        });
        setScreen({ type: "error", message: getFriendlyError(result.error, "No pudimos registrar tu entrada. Intentá nuevamente.") });
        return;
      }
      const time = result?.hora
        ? formatTimeLocal(result.hora)
        : new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
      setEmployees((prev) => prev.map((e) => e.id === employee.id ? { ...e, entryTime: time, estado: "en_jornada" } : e));
      trackFichajeEvento({
        evento: "entrada_exitosa",
        empresa_id: empresaId,
        empleado_id: employee.id,
        resultado: "ok",
        metadata: {
          hora_fichaje: result?.hora ?? null,
          gps_precision_m: location?.accuracy ?? null,
        },
      });
      setScreen({ type: "confirm-entry", employee, time });
    } catch (err: any) {
      console.error("[Fichaje] Error entrada:", err);
      trackFichajeEvento({
        evento: "entrada_fallida",
        empresa_id: empresaId,
        empleado_id: employee.id,
        resultado: "error",
        error_mensaje: err?.message,
      });
      setScreen({ type: "error", message: getFriendlyError(err, "No pudimos registrar tu entrada. Intentá nuevamente.") });
    }
  }, [qrToken, empresaId, verifySubscriptionForEmployee, handleSelect]);

  const handleClockOut = useCallback(async (employee: Employee, location: GeoLocation | null, deviceId: string, biometricProof?: string) => {
    const subOk = await verifySubscriptionForEmployee(employee.id);
    if (!subOk) return;

    if (employee.estado !== "en_jornada") {
      setScreen({ type: "error", message: "No registraste tu entrada hoy" });
      return;
    }

    trackFichajeEvento({
      evento: "salida_intentada",
      empresa_id: empresaId,
      empleado_id: employee.id,
      metadata: {
        hora_entrada_registrada: employee.entryTime,
        gps_disponible: !!location,
        gps_precision_m: location?.accuracy ?? null,
        device_id_presente: !!deviceId,
      },
    });

    try {
      const result = await ficharSalida(qrToken, employee.id, location, deviceId, biometricProof, employee.registroId);
      if (result?.success === false) {
        if (result.codigo === "TURNO_DESACTUALIZADO" || result.codigo === "TURNO_ABIERTO") {
          await handleSelect(employee);
          setTurnoAbiertoModal(true);
          return;
        }
        if (result.codigo === "PLAN_VENCIDO" || result.error === PLAN_VENCIDO_DEFAULT_MSG) {
          setPlanVencidoModalMsg(result.error || PLAN_VENCIDO_DEFAULT_MSG);
          return;
        }
        const esGeofence = result.error?.toLowerCase().includes("rango") || result.error?.toLowerCase().includes("geovalla");
        trackFichajeEvento({
          evento: esGeofence ? "gps_fuera_de_rango" : "salida_fallida",
          empresa_id: empresaId,
          empleado_id: employee.id,
          resultado: "error",
          error_mensaje: result.error,
          metadata: {
            gps_precision_m: location?.accuracy ?? null,
            gps_lat: location?.latitude ?? null,
            gps_lng: location?.longitude ?? null,
          },
        });
        setScreen({ type: "error", message: getFriendlyError(result.error, "No pudimos registrar tu salida. Intentá nuevamente.") });
        return;
      }
      const time = result?.hora
        ? formatTimeLocal(result.hora)
        : new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
      const hoursWorked = result?.horas_trabajadas ? formatDecimalHours(result.horas_trabajadas) : "--";
      trackFichajeEvento({
        evento: "salida_exitosa",
        empresa_id: empresaId,
        empleado_id: employee.id,
        resultado: "ok",
        metadata: {
          hora_fichaje: result?.hora ?? null,
          horas_trabajadas: result?.horas_trabajadas ?? null,
          es_feriado: result?.es_feriado ?? false,
          gps_precision_m: location?.accuracy ?? null,
        },
      });
      setScreen({ type: "confirm-exit", employee, time, hoursWorked });
    } catch (err: any) {
      console.error("[Fichaje] Error salida:", err);
      trackFichajeEvento({
        evento: "salida_fallida",
        empresa_id: empresaId,
        empleado_id: employee.id,
        resultado: "error",
        error_mensaje: err?.message,
      });
      setScreen({ type: "error", message: getFriendlyError(err, "No pudimos registrar tu salida. Intentá nuevamente.") });
    }
  }, [qrToken, empresaId, verifySubscriptionForEmployee, handleSelect]);

  const goToSelection = useCallback(() => setScreen({ type: "selection" }), []);

  console.log("-> Renderizando UI, screen.type =", screen.type, "| splashVisible =", splashVisible);

  const renderScreen = () => {
    switch (screen.type) {
      case "loading":
        return (
          <div style={{ minHeight: "100vh", backgroundColor: "#fff" }}>
            <FichajeSplash visible={splashVisible} />
            {/* Visible fallback while data loads */}
            {!splashVisible && (
              <div
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 40, height: 40, border: "3px solid #F97316",
                      borderTopColor: "transparent", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto 16px",
                    }}
                  />
                  <p style={{ color: "#1A1A1A", opacity: 0.4, fontSize: "0.9rem" }}>Cargando…</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>
        );

      case "selection":
        return (
          <>
            <FichajeSplash visible={splashVisible} />
            <SelectionScreen
              companyName={companyName}
              employees={employees}
              onSelect={handleSelect}
            />
          </>
        );

      case "action":
        return (
          <ActionScreen
            employee={screen.employee}
            empresaId={empresaId}
            qrToken={qrToken}
            onBack={goToSelection}
            onClockIn={(loc, deviceId, proof) => handleClockIn(screen.employee, loc, deviceId, proof)}
            onClockOut={(loc, deviceId, proof) => handleClockOut(screen.employee, loc, deviceId, proof)}
            onCheckSubscription={() => verifySubscriptionForEmployee(screen.employee.id)}
          />
        );

      case "confirm-entry":
        return (
          <ConfirmationScreen
            type="entry"
            time={screen.time}
            employeeName={screen.employee.name}
            onDone={goToSelection}
          />
        );

      case "confirm-exit":
        return (
          <ConfirmationScreen
            type="exit"
            time={screen.time}
            employeeName={screen.employee.name}
            hoursWorked={screen.hoursWorked}
            onDone={goToSelection}
          />
        );

      case "error":
        return <ErrorScreen message={screen.message} onBack={goToSelection} />;

      default:
        return (
          <div style={{ padding: 20, color: "red", fontFamily: "monospace" }}>
            Error: estado desconocido — recargá la página.
          </div>
        );
    }
  };

  return (
    <>
      {renderScreen()}
      <AlertDialog open={turnoAbiertoModal} onOpenChange={setTurnoAbiertoModal}>
        <AlertDialogContent className="rounded-2xl border-amber-200 p-6">
          <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden="true" />
          <AlertDialogTitle>Tenés un turno pendiente</AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed text-foreground/80">
            {TURNO_ABIERTO_MSG}
          </AlertDialogDescription>
          <AlertDialogAction className="min-h-12 bg-orange-600 text-white hover:bg-orange-700">Entendido</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Critical Non-Dismissible Modal for Expired Plan */}
      {planVencidoModalMsg !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="plan-vencido-title"
          aria-describedby="plan-vencido-desc"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-5"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-7 w-7" strokeWidth={2} />
            </div>

            <h2
              id="plan-vencido-title"
              className="text-[#1A1A1A]"
              style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3 }}
            >
              Atención: Suscripción Vencida
            </h2>

            <p
              id="plan-vencido-desc"
              className="mt-3 text-[#1A1A1A]/75"
              style={{ fontSize: "0.9375rem", lineHeight: 1.55 }}
            >
              {planVencidoModalMsg}
            </p>

            <button
              type="button"
              onClick={() => {
                setPlanVencidoModalMsg(null);
                goToSelection();
              }}
              className="mt-6 w-full rounded-xl bg-red-600 py-3.5 px-4 text-white transition-colors hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              style={{ fontSize: "0.9375rem", fontWeight: 600, minHeight: 50 }}
            >
              Entendido, avisaré al administrador
            </button>
          </div>
        </div>
      )}
    </>
  );
}
