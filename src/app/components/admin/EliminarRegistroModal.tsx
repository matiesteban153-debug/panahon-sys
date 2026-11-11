import { useState } from "react";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { eliminarRegistro, formatTimeLocal } from "../../lib/api";
import { getFriendlyError } from "../../lib/errorUtils";
import { useAuth } from "../../lib/auth-context";

interface EliminarRegistroModalProps {
  registro: {
    id: string;
    fecha: string;
    hora_entrada: string;
    hora_salida?: string | null;
    horas_totales?: number | null;
    empleadoNombre: string;
  };
  onClose: () => void;
  onSuccess: (registroId: string) => void;
}

function formatHorasModal(h: number): string {
  const hs = Math.floor(h);
  const ms = Math.round((h - hs) * 60);
  return ms > 0 ? `${hs}h ${ms}m` : `${hs}h`;
}

function formatFechaModal(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

export function EliminarRegistroModal({ registro, onClose, onSuccess }: EliminarRegistroModalProps) {
  const { admin } = useAuth();
  const [motivo, setMotivo]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const motivoValido = motivo.trim().length >= 10;

  const handleEliminar = async () => {
    if (!motivoValido || saving || !admin?.id) return;
    setError("");
    setSaving(true);
    try {
      await eliminarRegistro(registro.id, motivo.trim(), admin.id);
      onSuccess(registro.id);
    } catch (err) {
      setError(getFriendlyError(err, "No se pudo eliminar el registro. Intentá nuevamente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        className="w-full max-w-[440px] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1.0625rem", fontWeight: 700 }}>
              Eliminar registro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#1A1A1A]/40 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-[#1A1A1A] dark:hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
          {/* Record summary */}
          <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50 px-4 py-3.5 space-y-1">
            <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
              {registro.empleadoNombre}
            </p>
            <p className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
              {formatFechaModal(registro.fecha)}
            </p>
            <p className="text-[#6B7280] dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
              {formatTimeLocal(registro.hora_entrada)}
              {registro.hora_salida ? (
                <>
                  {" → "}
                  {formatTimeLocal(registro.hora_salida)}
                  {registro.horas_totales ? ` · ${formatHorasModal(registro.horas_totales)}` : ""}
                </>
              ) : (
                <span className="ml-1.5 text-red-400" style={{ fontSize: "0.8125rem" }}>(abierto)</span>
              )}
            </p>
          </div>

          {/* Warning */}
          <div className="flex gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-amber-700 dark:text-amber-400" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Este registro no aparecerá más en los reportes ni en la vista de registros. Quedará en el historial para consulta.
            </p>
          </div>

          {/* Motivo */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Motivo de eliminación <span className="text-red-400">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setError(""); }}
              placeholder="Ej: El empleado fichó por error, turno duplicado, horario ya cargado..."
              rows={3}
              maxLength={300}
              autoFocus
              disabled={saving}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none bg-white dark:bg-zinc-800 disabled:opacity-60"
              style={{ fontSize: "0.9375rem" }}
            />
            <p className="mt-1 text-right" style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
              {motivo.trim().length}/300
              {motivo.length > 0 && motivo.trim().length < 10 && (
                <span className="ml-1 text-amber-500">· mínimo 10 caracteres</span>
              )}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3.5 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-red-600 dark:text-red-400" style={{ fontSize: "0.8125rem" }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              style={{ fontSize: "0.9375rem", fontWeight: 500 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEliminar}
              disabled={!motivoValido || saving}
              className="flex-1 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontSize: "0.9375rem", fontWeight: 600 }}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando…</>
              ) : (
                <><Trash2 className="w-4 h-4" strokeWidth={1.75} /> Eliminar registro</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
