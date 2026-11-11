import { useState, useEffect, Component, type ReactNode } from "react";
import { ArrowLeft, Clock, MapPin, Loader2, RefreshCw } from "lucide-react";
import { EmployeeAvatar } from "./Avatar";
import type { Employee, GeoLocation } from "./types";
import { trackFichajeEvento } from "../../lib/fichaje-pulse";
import { ClockHelp } from "./ClockHelp";
import { EmployeeBiometrics } from "./EmployeeBiometrics";

class BiometricsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[Biometrics] Módulo biométrico aislado por error:", error);
  }
  render() {
    if (this.state.hasError) return <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La biometría no está disponible. Podés fichar con el botón habitual y GPS.</p>;
    return this.props.children;
  }
}

interface ActionScreenProps {
  employee: Employee;
  empresaId: string | null;
  qrToken: string;
  onBack: () => void;
  onClockIn: (location: GeoLocation | null, deviceId: string, biometricProof?: string) => Promise<void> | void;
  onClockOut: (location: GeoLocation | null, deviceId: string, biometricProof?: string) => Promise<void> | void;
  onCheckSubscription?: () => Promise<boolean>;
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Geolocation hook ─────────────────────────────────────────────────────────
type GeoStatus = "loading" | "ok" | "denied" | "unavailable";

interface GeoResult {
  location: GeoLocation | null;
  status: GeoStatus;
  isRetrying: boolean;
  retry: () => void;
}

function useGeolocation(empresaId: string | null, empleadoId: string): GeoResult {
  const [location, setLocation]   = useState<GeoLocation | null>(null);
  const [status, setStatus]       = useState<GeoStatus>("loading");
  const [isRetrying, setIsRetrying] = useState(false);

  const doFetch = (manual: boolean) => {
    if (!navigator.geolocation) {
      trackFichajeEvento({
        evento: "gps_rechazado",
        empresa_id: empresaId,
        empleado_id: empleadoId,
        resultado: "error",
        error_codigo: "gps_no_disponible",
        error_mensaje: "navigator.geolocation not available",
      });
      setLocation(null);
      setStatus("unavailable");
      setIsRetrying(false);
      return;
    }

    if (manual) {
      setStatus("loading");
      setIsRetrying(true);
    }

    trackFichajeEvento({
      evento: "gps_solicitado",
      empresa_id: empresaId,
      empleado_id: empleadoId,
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        trackFichajeEvento({
          evento: "gps_concedido",
          empresa_id: empresaId,
          empleado_id: empleadoId,
          resultado: "ok",
          metadata: {
            precision_m: pos.coords.accuracy,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus("ok");
        setIsRetrying(false);
      },
      (err) => {
        console.log("[Geolocation] error:", err.code, err.message);
        const isDenied  = err.code === 1;
        const isTimeout = err.code === 3;
        trackFichajeEvento({
          evento: isTimeout ? "gps_timeout" : "gps_rechazado",
          empresa_id: empresaId,
          empleado_id: empleadoId,
          resultado: "error",
          error_codigo: isDenied ? "permission_denied" : isTimeout ? "timeout" : "position_unavailable",
          error_mensaje: err.message,
        });
        setLocation(null);
        setStatus(isDenied ? "denied" : "unavailable");
        setIsRetrying(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    doFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, status, isRetrying, retry: () => doFetch(true) };
}

// ─── Device ID hook ────────────────────────────────────────────────────────────
const DEVICE_ID_KEY = "panahon_device_id";

function useDeviceId(): string {
  const [deviceId] = useState<string>(() => {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  });
  return deviceId;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionScreen({
  employee,
  empresaId,
  qrToken,
  onBack,
  onClockIn,
  onClockOut,
  onCheckSubscription,
}: ActionScreenProps) {
  const now          = useCurrentTime();
  const hasClockedIn = employee.estado === "en_jornada";
  const isComplete   = employee.estado === "jornada_completa";
  const geo          = useGeolocation(empresaId, employee.id);
  const deviceId     = useDeviceId();

  const [processing, setProcessing] = useState<"in" | "out" | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const isProcessing = processing !== null;

  // Block while GPS is still resolving (initial or retry) or permission hard-denied
  const gpsBlocking    = geo.status === "loading" || geo.status === "denied";
  const buttonDisabled = isProcessing || gpsBlocking;

  // Show retry button unless we're in the initial silent load
  const isInitialLoad  = geo.status === "loading" && !geo.isRetrying;
  const showRetryBtn   = !isInitialLoad && !isComplete;

  // Classic GPS clock-in/out: completely independent of WebAuthn
  const handleClassicClockIn = async () => {
    if (buttonDisabled) return;
    setProcessing("in");
    try {
      await onClockIn(geo.location, deviceId);
    } finally {
      setProcessing(null);
    }
  };

  const handleClassicClockOut = async () => {
    if (buttonDisabled) return;
    setProcessing("out");
    try {
      await onClockOut(geo.location, deviceId);
    } finally {
      setProcessing(null);
    }
  };

  // Optional biometric clock-in/out handler
  const handleBiometricClock = async (biometricProof?: string) => {
    if (buttonDisabled) return;
    const SafeProof = typeof biometricProof === "string" && biometricProof.trim() ? biometricProof : undefined;
    if (hasClockedIn) {
      setProcessing("out");
      try {
        await onClockOut(geo.location, deviceId, SafeProof);
      } finally {
        setProcessing(null);
      }
    } else {
      setProcessing("in");
      try {
        await onClockIn(geo.location, deviceId, SafeProof);
      } finally {
        setProcessing(null);
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Back button */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="flex items-center gap-1.5 text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors p-2 -ml-2 min-w-[48px] min-h-[48px] disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-5 h-5" />
          <span style={{ fontSize: "0.9375rem" }}>Volver</span>
        </button>
        <ClockHelp gpsStatus={geo.status} accuracy={geo.location?.accuracy} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-5">
        {/* Avatar */}
        <div className="mt-8">
          <EmployeeAvatar name={employee.name} size="lg" />
        </div>

        {/* Name */}
        <h1
          className="text-[#1A1A1A] text-center mt-5"
          style={{ fontSize: "1.625rem", fontWeight: 700 }}
        >
          {employee.name}
        </h1>
        <button type="button" onClick={() => setProfileOpen(true)} className="mt-1 min-h-11 rounded-lg px-3 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Mis datos</button>

        {/* Date & time */}
        <div className="flex items-center gap-2 mt-4 text-[#1A1A1A]/40">
          <Clock className="w-4 h-4" strokeWidth={1.5} />
          <span style={{ fontSize: "0.8125rem" }} className="capitalize">
            {formatDate(now)}
          </span>
        </div>
        <p
          className="text-[#1A1A1A] mt-2 tabular-nums"
          style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {formatTime(now)}
        </p>

        {/* Location status + retry */}
        <div className="mt-3 flex flex-col items-center gap-2">
          {/* Status badge */}
          <div className="min-h-[22px] flex items-center">
            {isInitialLoad && (
              <div className="flex items-center gap-1.5 text-[#1A1A1A]/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                <span style={{ fontSize: "0.75rem" }}>Obteniendo ubicación…</span>
              </div>
            )}
            {geo.isRetrying && (
              <div className="flex items-center gap-1.5 text-[#1A1A1A]/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                <span style={{ fontSize: "0.75rem" }}>Detectando ubicación…</span>
              </div>
            )}
            {!geo.isRetrying && geo.status === "denied" && (
              <div className="flex items-center gap-1.5 text-red-500">
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                  Permiso de ubicación denegado
                </span>
              </div>
            )}
            {!geo.isRetrying && geo.status === "unavailable" && (
              <div className="flex items-center gap-1.5 text-amber-500">
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span style={{ fontSize: "0.75rem" }}>No se pudo obtener la ubicación</span>
              </div>
            )}
            {!geo.isRetrying && geo.status === "ok" && (
              <div className="flex items-center gap-1.5 text-emerald-500">
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span style={{ fontSize: "0.75rem" }}>Ubicación registrada</span>
              </div>
            )}
          </div>

          {/* Friendly error messages (appear automatically on failure) */}
          {!geo.isRetrying && geo.status === "denied" && (
            <p
              className="text-center text-[#1A1A1A]/45 max-w-[280px]"
              style={{ fontSize: "0.75rem", lineHeight: 1.5 }}
            >
              Por favor, activá el permiso de ubicación en tu navegador para fichar.
            </p>
          )}
          {!geo.isRetrying && geo.status === "unavailable" && (
            <p
              className="text-center text-[#1A1A1A]/45 max-w-[280px]"
              style={{ fontSize: "0.75rem", lineHeight: 1.5 }}
            >
              No se pudo obtener tu ubicación. Asegurate de tener el GPS encendido y estar en un lugar con buena señal.
            </p>
          )}

          {/* Retry / update location button */}
          {showRetryBtn && (
            <button
              type="button"
              onClick={geo.retry}
              disabled={geo.isRetrying || isProcessing}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 ${
                geo.status === "ok"
                  ? "text-[#1A1A1A]/35 hover:text-[#1A1A1A]/55"
                  : "border border-[#1A1A1A]/12 bg-white text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/4 active:bg-[#1A1A1A]/8"
              }`}
              style={{ fontSize: "0.8125rem", fontWeight: geo.status === "ok" ? 400 : 500 }}
            >
              {geo.isRetrying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  <span>Detectando…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{geo.status === "ok" ? "Actualizar ubicación" : "Detectar ubicación"}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-8" />

        {/* Status & Action */}
        <div className="w-full max-w-sm mb-16">
          {isComplete ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-[#22C55E]/8 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
              <p className="text-[#22C55E]" style={{ fontSize: "0.9375rem", fontWeight: 500 }}>
                Jornada completa. ¡Hasta mañana!
              </p>
            </div>
          ) : hasClockedIn ? (
            <>
              {/* Entry indicator */}
              <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 bg-[#22C55E]/8 rounded-xl">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                <p className="text-[#22C55E]" style={{ fontSize: "0.9375rem", fontWeight: 500 }}>
                  Entrada registrada a las {employee.entryTime}
                </p>
              </div>

              {/* Clock-out button */}
              <button
                type="button"
                onClick={handleClassicClockOut}
                disabled={buttonDisabled}
                className="w-full py-4 rounded-[10px] bg-[#374151] text-white transition-all hover:bg-[#4B5563] active:bg-[#1F2937] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                style={{ fontSize: "1.125rem", fontWeight: 600, minHeight: 56 }}
              >
                {processing === "out" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>Procesando…</span>
                  </>
                ) : geo.status === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>Obteniendo ubicación…</span>
                  </>
                ) : (
                  <span>Marcar salida</span>
                )}
              </button>
            </>
          ) : (
            /* Clock-in button */
            <button
              type="button"
              onClick={handleClassicClockIn}
              disabled={buttonDisabled}
              className="w-full py-4 rounded-[10px] bg-[#F97316] text-white transition-all hover:bg-[#EA6C0A] active:bg-[#DC6A0A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              style={{ fontSize: "1.125rem", fontWeight: 600, minHeight: 56 }}
            >
              {processing === "in" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>Procesando…</span>
                </>
              ) : geo.status === "loading" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>Obteniendo ubicación…</span>
                </>
              ) : (
                <span>Fichar entrada</span>
              )}
            </button>
          )}

          <BiometricsErrorBoundary key={employee.id}>
            <EmployeeBiometrics
              employee={employee}
              qrToken={qrToken}
              profileOpen={profileOpen}
              onProfileOpenChange={setProfileOpen}
              disabled={buttonDisabled}
              complete={isComplete}
              onConfirm={handleBiometricClock}
              onCheckSubscription={onCheckSubscription}
              clockAction={hasClockedIn ? "salida" : "entrada"}
            />
          </BiometricsErrorBoundary>

          {!isComplete && (
            <p className="mt-3 px-3 text-center text-xs leading-5 text-slate-500">
              Al marcar asistencia, autorizas el uso temporal de tu ubicación para validar la geovalla del local.{" "}
              <a href="/privacidad" className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[#C9570A] hover:decoration-[#C9570A]">
                Ver política de privacidad
              </a>
            </p>
          )}

          {/* Soft warning when unavailable but not blocking */}
          {!geo.isRetrying && geo.status === "unavailable" && (
            <p className="mt-3 text-center text-amber-600" style={{ fontSize: "0.75rem" }}>
              Sin GPS preciso — el sistema podría rechazar el fichaje si la empresa requiere geovalla.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
