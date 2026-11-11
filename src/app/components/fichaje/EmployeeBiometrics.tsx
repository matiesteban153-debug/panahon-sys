import { useEffect, useRef, useState } from "react";
import { Check, Fingerprint, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import type { Employee } from "./types";
import { authenticateEmployeeDevice, registerEmployeeDevice, webAuthnErrorMessage, WebAuthnError } from "../../lib/webauthn";

interface EmployeeBiometricsProps {
  employee: Employee;
  profileOpen: boolean;
  onProfileOpenChange: (open: boolean) => void;
  disabled: boolean;
  complete: boolean;
  onConfirm: (proof?: string) => Promise<void>;
  onCheckSubscription?: () => Promise<boolean>;
  qrToken: string;
  clockAction: "entrada" | "salida";
}

async function withBiometricDeadline<Result>(operation: () => Promise<Result>, controller: AbortController): Promise<Result> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new WebAuthnError("La verificación biométrica se canceló. No se registró asistencia."));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        timeout = setTimeout(() => {
          reject(new WebAuthnError("La biometría no respondió a tiempo. No se registró asistencia."));
          controller.abort();
        }, 25000);
      }),
      operation(),
    ]);
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", onAbort);
  }
}

const CLASSIC_FALLBACK_NOTICE = "Podés registrar tu asistencia con el botón habitual y GPS, sin biometría. Se mantienen las validaciones de ubicación y suscripción.";

export function EmployeeBiometrics({ employee, profileOpen, onProfileOpenChange, disabled, complete, onConfirm, onCheckSubscription, clockAction, qrToken }: EmployeeBiometricsProps) {
  const [linked, setLinked] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [fallbackNotice, setFallbackNotice] = useState("");
  const [stage, setStage] = useState<"unlinked" | "scanning" | "success" | "error" | null>(null);
  const requestId = useRef(0);
  const linkPending = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const proof = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestId.current += 1; controller.current?.abort(); };
  }, []);

  const linkDevice = async () => {
    if (linkPending.current || linked) return;
    linkPending.current = true;
    setLinking(true);
    setLinkError("");
    controller.current = new AbortController();
    try {
      const activeController = controller.current;
      await withBiometricDeadline(() => registerEmployeeDevice(employee.id, qrToken, activeController.signal), activeController);
      if (!mounted.current) return;
      setLinked(true);
    } catch (error) {
      if (mounted.current) {
        setLinkError(webAuthnErrorMessage(error));
        setFallbackNotice(`${webAuthnErrorMessage(error)} ${CLASSIC_FALLBACK_NOTICE}`);
      }
    } finally {
      linkPending.current = false;
      if (mounted.current) setLinking(false);
    }
  };

  const verifyDevice = async () => {
    if (disabled || complete || stage === "scanning" || linkPending.current) return;
    const currentRequest = ++requestId.current;
    setVerificationError("");
    setStage("scanning");
    proof.current = null;
    controller.current = new AbortController();
    try {
      const activeController = controller.current;
      const verifiedProof = await withBiometricDeadline(async () => {
        if (onCheckSubscription && !(await onCheckSubscription())) return null;
        if (activeController.signal.aborted) throw new WebAuthnError("La verificación fue cancelada.");
        return authenticateEmployeeDevice(employee.id, qrToken, activeController.signal);
      }, activeController);
      if (!mounted.current || currentRequest !== requestId.current) return;
      if (!verifiedProof) {
        setStage(null);
        return;
      }
      proof.current = verifiedProof;
      setFallbackNotice("");
      setStage("success");
    } catch (error) {
      if (!mounted.current || currentRequest !== requestId.current) return;
      proof.current = null;
      controller.current?.abort();
      setFallbackNotice(`${webAuthnErrorMessage(error)} ${CLASSIC_FALLBACK_NOTICE}`);
      setStage(null);
    }
  };

  const closeVerification = () => {
    if (stage === "scanning") setFallbackNotice(`La verificación biométrica se canceló. No se registró asistencia. ${CLASSIC_FALLBACK_NOTICE}`);
    requestId.current += 1;
    controller.current?.abort();
    proof.current = null;
    setStage(null);
  };

  const confirmClock = async () => {
    if (disabled || complete || stage !== "success" || !proof.current) return;
    const verifiedProof = proof.current;
    closeVerification();
    try {
      await onConfirm(verifiedProof);
    } catch {
      if (!mounted.current) return;
      setVerificationError("No pudimos registrar la asistencia. Revisá tu conexión y comprobá si se registró antes de volver a intentar.");
      setStage("error");
    }
  };

  const fallbackToClassicClock = async () => {
    if (disabled || complete) return;
    closeVerification();
    try {
      await onConfirm();
    } catch {
      // ActionScreen / FichajeApp handles clock errors
    }
  };

  const openProfile = () => {
    closeVerification();
    onProfileOpenChange(true);
  };

  const changeProfile = (open: boolean) => {
    if (!open && linkPending.current) controller.current?.abort();
    onProfileOpenChange(open);
  };

  return (
    <>
      {fallbackNotice && <p role="status" aria-live="polite" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">{fallbackNotice}</p>}
      {!complete && <button type="button" disabled={disabled || stage === "scanning"} onClick={verifyDevice} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"><Fingerprint className="size-[18px]" strokeWidth={1.7} /> Fichar con Biometría (Opcional)</button>}

      <Dialog open={profileOpen} onOpenChange={changeProfile}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl border-slate-200 bg-white text-slate-900 sm:max-w-md [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-slate-100 [&>button]:opacity-100">
          <DialogTitle className="pr-12 text-xl">Mis datos</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">Tu perfil y las opciones de este celular.</DialogDescription>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Empleado</p><p className="mt-1 text-base font-semibold">{employee.name}</p></div>
          <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="device-security-title">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ShieldCheck className="size-5" strokeWidth={1.6} /></span><div><h2 id="device-security-title" className="text-sm font-semibold">Seguridad del Dispositivo</h2><p className="mt-1 text-xs leading-relaxed text-slate-600">Vinculá un identificador de este celular a tu perfil. El fichaje habitual siempre seguirá disponible.</p></div></div>
            <div aria-live="polite" className="mt-4 flex items-center gap-2 text-xs text-slate-600"><Smartphone className="size-4" /><span>{linked ? "Dispositivo vinculado correctamente" : "Vinculación pendiente de confirmar"}</span>{linked && <Check className="size-4 text-green-700" />}</div>
            <button type="button" disabled={linking || linked} onClick={linkDevice} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60">{linking ? <Loader2 className="size-[18px] animate-spin" /> : <Fingerprint className="size-[18px]" />}{linking ? "Vinculando dispositivo..." : linked ? "Dispositivo vinculado" : "Vincular este celular"}</button>
            {linkError && <p role="alert" className="mt-3 text-xs leading-relaxed text-red-700">{linkError}</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">El sistema del celular verifica tu identidad con huella, Face ID o PIN. La clave privada queda en el autenticador. Para la primera vinculación se requiere autorización del administrador; no se admiten claves sincronizadas con otros dispositivos.</p>
          </section>
          <button type="button" onClick={() => changeProfile(false)} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Volver al fichaje</button>
        </DialogContent>
      </Dialog>

      <Dialog open={stage !== null} onOpenChange={(open) => { if (!open) closeVerification(); }}>
        <DialogContent className="rounded-2xl border-slate-200 bg-white text-slate-900 sm:max-w-sm [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-slate-100 [&>button]:opacity-100">
          <span className={`flex size-12 items-center justify-center rounded-2xl ${stage === "success" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{stage === "success" ? <Check className="size-6" /> : <Fingerprint className="size-7" strokeWidth={1.5} />}</span>
          <DialogTitle className="pr-8 text-lg leading-snug">{stage === "unlinked" ? "Primero, vinculá tu celular" : stage === "scanning" ? "Verificando tu identidad..." : stage === "error" ? "No pudimos completar la acción" : "Identidad verificada"}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600">{stage === "unlinked" ? "Vinculá tu huella o Face ID por primera vez desde los ajustes de tu perfil" : stage === "scanning" ? "Seguí las indicaciones del sistema para usar huella, Face ID o PIN. Después verificaremos la firma de tu dispositivo." : stage === "error" ? verificationError : `Firma verificada. Confirmá tu ${clockAction} en los próximos 60 segundos; se aplican las validaciones habituales de ubicación.`}</DialogDescription>
          {stage === "scanning" && <div role="status" className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Esperando respuesta</div>}
          {stage === "success" && <><button type="button" disabled={disabled || complete} onClick={confirmClock} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50">Confirmar {clockAction}</button>{disabled && <p role="status" className="text-xs text-slate-600">Esperá a que termine la ubicación o habilitá el permiso GPS para fichar.</p>}</>}
          {stage === "error" && !disabled && !complete && (
            <button type="button" onClick={fallbackToClassicClock} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              Fichar {clockAction} por GPS (sin biometría)
            </button>
          )}
          {stage === "unlinked" && <button type="button" onClick={openProfile} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Ir a mis datos</button>}
          <button type="button" onClick={closeVerification} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{stage === "scanning" ? "Cancelar" : "Volver al fichaje habitual"}</button>
        </DialogContent>
      </Dialog>
    </>
  );
}
