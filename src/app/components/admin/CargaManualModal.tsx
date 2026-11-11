import { useState } from "react";
import { X, Loader2, Check, AlertCircle, ClipboardEdit, Clock, FileEdit } from "lucide-react";
import { cargarTurnoManual, formatTimeLocal, type CargarTurnoResult } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { trackEvent } from "../../lib/telemetry";
import { getFriendlyError } from "../../lib/errorUtils";

interface Employee {
  id: string;
  nombre_completo: string;
  activo?: boolean;
  valor_hora?: number;
}

interface InitialRecord {
  id?: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  horas_totales?: number | null;
  nota_interna?: string | null;
  editado_manual?: boolean;
}

interface Props {
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
  initialEmpleadoId?: string;
  initialFecha?: string;
  initialRecord?: InitialRecord;
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Convert a UTC timestamptz to HH:MM in local time for <input type="time">
function tsToTimeInput(ts: string | null | undefined): string {
  if (!ts) return "";
  return formatTimeLocal(ts);
}

interface HorasPreview {
  total: number;
  display: string;
  midnightCrossing: boolean;
}

/**
 * Strips non-digits and formats as HH:MM while typing.
 * "0900" → "09:00", "2100" → "21:00"
 * Works correctly with backspace: "09:0" → backspace → "09:"
 * We strip the colon out, keep only digits, then re-insert at position 2.
 */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

/** Returns true only when the value is a complete, valid 24h HH:MM time. */
function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function calcPreview(entrada: string, salida: string): HorasPreview | null {
  if (!entrada || !salida) return null;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  let minIn  = h1 * 60 + m1;
  let minOut = h2 * 60 + m2;
  if (minOut <= minIn) minOut += 24 * 60;
  const total = (minOut - minIn) / 60;
  const horas = Math.floor(total);
  const mins  = Math.round((total - horas) * 60);
  return {
    total,
    display: mins > 0 ? `${horas} hs ${mins} min` : `${horas} hs`,
    midnightCrossing: minOut > 24 * 60,
  };
}

function formatHorasDecimal(h: number | null | undefined): string {
  if (!h) return "—";
  const hs = Math.floor(h);
  const ms = Math.round((h - hs) * 60);
  return ms > 0 ? `${hs} hs ${ms} min` : `${hs} hs`;
}

export function CargaManualModal({
  employees, onClose, onSuccess,
  initialEmpleadoId, initialFecha, initialRecord,
}: Props) {
  const { admin } = useAuth();
  const isEdit = !!initialRecord;

  // Form fields
  const [empleadoId, setEmpleadoId]   = useState(initialEmpleadoId || "");
  const [fecha, setFecha]             = useState(initialFecha || todayLocal());
  const [horaEntrada, setHoraEntrada] = useState(tsToTimeInput(initialRecord?.hora_entrada));
  const [horaSalida, setHoraSalida]   = useState(tsToTimeInput(initialRecord?.hora_salida));
  const [notaInterna, setNotaInterna] = useState(initialRecord?.nota_interna || "");

  // UI
  const [saving, setSaving]                     = useState(false);
  const [result, setResult]                     = useState<CargarTurnoResult | null>(null);
  const [error, setError]                       = useState("");
  const [showMidnightConfirm, setShowMidnightConfirm] = useState(false);

  const activeEmployees = employees.filter((e) => e.activo !== false);
  const preview = isValidTime(horaEntrada) && isValidTime(horaSalida) ? calcPreview(horaEntrada, horaSalida) : null;

  const empleadoNombre =
    activeEmployees.find((e) => e.id === empleadoId)?.nombre_completo ?? "";

  // Actual save — called either directly or after midnight confirmation
  const doSave = async () => {
    setSaving(true);
    try {
      const res = await cargarTurnoManual({
        empleado_id:  empleadoId,
        fecha,
        hora_entrada: horaEntrada,
        hora_salida:  horaSalida || null,
        nota_interna: notaInterna.trim() || undefined,
        registro_id:  initialRecord?.id,
      });
      setResult(res);
      trackEvent({
        evento: isEdit ? "turno_editado_manual" : "turno_cargado_manual",
        empresa_id: admin?.empresa_id,
        empleado_id: empleadoId,
        registro_id: initialRecord?.id,
        resultado: "ok",
        metadata: {
          fecha,
          horas_totales: res.horas_totales,
          es_feriado: res.es_feriado ?? false,
          con_nota: !!notaInterna.trim(),
        },
      });
      onSuccess();
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error("[CargaManual]", err);
      trackEvent({
        evento: isEdit ? "turno_editado_manual" : "turno_cargado_manual",
        empresa_id: admin?.empresa_id,
        empleado_id: empleadoId,
        resultado: "error",
        error_mensaje: err.message,
        metadata: { fecha },
      });
      setError(getFriendlyError(err, "No pudimos guardar el registro. Revisá las horas ingresadas e intentá nuevamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setShowMidnightConfirm(false);

    if (!empleadoId)               { setError("Seleccioná un empleado."); return; }
    if (!fecha)                    { setError("Seleccioná una fecha."); return; }
    if (!isValidTime(horaEntrada)) { setError("Ingresá una hora de entrada válida (HH:MM)."); return; }
    if (horaSalida && !isValidTime(horaSalida)) { setError("Ingresá una hora de salida válida (HH:MM)."); return; }
    if (horaSalida && horaEntrada === horaSalida) {
      setError("La hora de entrada y salida no pueden ser iguales.");
      return;
    }

    // Detect midnight crossing: salida en minutos < entrada en minutos
    if (horaSalida && isValidTime(horaSalida)) {
      const [h1, m1] = horaEntrada.split(":").map(Number);
      const [h2, m2] = horaSalida.split(":").map(Number);
      if (h2 * 60 + m2 < h1 * 60 + m1) {
        setShowMidnightConfirm(true);
        return;
      }
    }

    doSave();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF4EC] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
              {isEdit
                ? <FileEdit className="w-4 h-4 text-[#F97316]" strokeWidth={1.75} />
                : <ClipboardEdit className="w-4 h-4 text-[#F97316]" strokeWidth={1.75} />
              }
            </div>
            <div>
              <h2 className="text-[#1A1A1A] dark:text-zinc-50 leading-tight" style={{ fontSize: "1rem", fontWeight: 700 }}>
                {isEdit ? "Detalle de Turno" : "Carga Manual de Turno"}
              </h2>
              <p className="text-[#1A1A1A]/45 dark:text-zinc-500 leading-tight" style={{ fontSize: "0.75rem" }}>
                {isEdit
                  ? <>Editando registro · se guardará como <span className="font-semibold text-blue-500">Editado</span></>
                  : <>Se guardará con estado <span className="font-semibold text-blue-500">'Editado'</span></>
                }
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

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh] sm:max-h-none">

          {/* ── Read-only summary (edit mode only) ── */}
          {isEdit && (
            <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl px-4 py-3 space-y-2">
              <p className="text-[#6B7280] dark:text-zinc-400 uppercase tracking-wide" style={{ fontSize: "0.6875rem", fontWeight: 600 }}>
                Datos registrados por el sistema
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[#9CA3AF] dark:text-zinc-500" style={{ fontSize: "0.75rem" }}>Entrada</p>
                  <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    {initialRecord?.hora_entrada ? formatTimeLocal(initialRecord.hora_entrada) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] dark:text-zinc-500" style={{ fontSize: "0.75rem" }}>Salida</p>
                  <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    {initialRecord?.hora_salida ? formatTimeLocal(initialRecord.hora_salida) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] dark:text-zinc-500" style={{ fontSize: "0.75rem" }}>Total</p>
                  <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    {formatHorasDecimal(initialRecord?.horas_totales)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empleado */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Empleado *
            </label>
            {isEdit ? (
              <div
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[#1A1A1A] dark:text-zinc-100"
                style={{ fontSize: "0.9375rem" }}
              >
                {empleadoNombre || "—"}
              </div>
            ) : (
              <select
                value={empleadoId}
                onChange={(e) => { setEmpleadoId(e.target.value); setError(""); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                style={{ fontSize: "0.9375rem" }}
              >
                <option value="">Seleccioná un empleado</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Fecha *
            </label>
            {isEdit ? (
              <div
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-[#1A1A1A] dark:text-zinc-100"
                style={{ fontSize: "0.9375rem" }}
              >
                {(() => {
                  const [y, m, d] = fecha.split("-");
                  return `${d}/${m}/${y}`;
                })()}
              </div>
            ) : (
              <input
                type="date"
                value={fecha}
                max={todayLocal()}
                onChange={(e) => { setFecha(e.target.value); setError(""); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                style={{ fontSize: "0.9375rem" }}
              />
            )}
          </div>

          {/* Separador edición */}
          {isEdit && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-700" />
              <span className="text-[#9CA3AF] dark:text-zinc-500" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                Editar horarios
              </span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-700" />
            </div>
          )}

          {/* Horarios */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                Hora de entrada *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={horaEntrada}
                onChange={(e) => { setHoraEntrada(formatTimeInput(e.target.value)); setError(""); }}
                placeholder="09:00"
                maxLength={5}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                style={{ fontSize: "0.9375rem", fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
            </div>
            <div>
              <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                Hora de salida{" "}
                <span className="text-[#1A1A1A]/30 dark:text-zinc-500 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={horaSalida}
                onChange={(e) => { setHoraSalida(formatTimeInput(e.target.value)); setError(""); }}
                placeholder="18:00"
                maxLength={5}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800"
                style={{ fontSize: "0.9375rem", fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
            </div>
          </div>

          {/* Preview horas calculadas */}
          {preview && (
            <div className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 ${preview.midnightCrossing ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50" : "bg-[#FFF4EC]"}`}>
              <Clock className={`w-4 h-4 flex-shrink-0 ${preview.midnightCrossing ? "text-amber-500" : "text-[#F97316]"}`} strokeWidth={1.75} />
              <span
                className={preview.midnightCrossing ? "text-amber-700" : "text-[#F97316]"}
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                {preview.display}
                {preview.midnightCrossing && (
                  <span className="ml-1.5 font-normal" style={{ fontSize: "0.8125rem" }}>
                    · cruza la medianoche
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Nota interna */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Nota interna{" "}
              <span className="text-[#1A1A1A]/30 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notaInterna}
              onChange={(e) => setNotaInterna(e.target.value)}
              placeholder="Ej: Turno recuperatorio, ajuste de horario, olvido de fichaje..."
              rows={2}
              maxLength={300}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] resize-none bg-white dark:bg-zinc-800"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>

          {/* Midnight crossing confirmation */}
          {showMidnightConfirm && !error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-3.5">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <p className="text-amber-800 dark:text-amber-300" style={{ fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.4 }}>
                    La salida ({horaSalida}) es anterior a la entrada ({horaEntrada}).
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5" style={{ fontSize: "0.875rem", fontWeight: 400 }}>
                    ¿La salida es del día siguiente?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowMidnightConfirm(false); doSave(); }}
                  className="flex-1 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  style={{ fontSize: "0.875rem", fontWeight: 600 }}
                >
                  Sí, día siguiente
                </button>
                <button
                  type="button"
                  onClick={() => setShowMidnightConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  No, corregir
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-red-600" style={{ fontSize: "0.8125rem" }}>{error}</p>
            </div>
          )}

          {/* Success feedback */}
          {result && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <p className="text-emerald-700" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {isEdit ? "Registro actualizado correctamente" : "Turno guardado correctamente"}
                </p>
                <p className="text-emerald-600 mt-0.5" style={{ fontSize: "0.8125rem" }}>
                  {result.horas_totales != null ? formatHorasDecimal(result.horas_totales) : "Sin hora de salida registrada"}
                  {result.es_feriado && result.feriado_descripcion && (
                    <span className="ml-1.5">· feriado: {result.feriado_descripcion}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              style={{ fontSize: "0.9375rem", fontWeight: 500 }}
            >
              {result ? "Cerrar" : "Cancelar"}
            </button>
            <button
              type="submit"
              disabled={saving || !!result || showMidnightConfirm}
              className="flex-1 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ fontSize: "0.9375rem", fontWeight: 600 }}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              ) : result ? (
                <><Check className="w-4 h-4" /> Guardado</>
              ) : isEdit ? (
                "Guardar Cambios"
              ) : (
                "Guardar Registro"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
