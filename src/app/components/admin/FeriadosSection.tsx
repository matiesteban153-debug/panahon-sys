import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Trash2, Loader2, Check, AlertCircle, PlusCircle } from "lucide-react";
import { getFeriados, createFeriado, deleteFeriado, type Feriado } from "../../lib/api";

interface Props {
  empresaId: string;
}

/** Format YYYY-MM-DD → lunes 25 de mayo de 2026 */
function formatFechaLarga(dateStr: string): string {
  // Parse as local date (avoid UTC offset shifting the day)
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Format YYYY-MM-DD → DD/MM/YYYY for the compact table column */
function formatFechaCorta(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/** Today's date as YYYY-MM-DD using the browser's local timezone */
function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function FeriadosSection({ empresaId }: Props) {
  // ── List state ────────────────────────────────────────────────────────────
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [multiplicador, setMultiplicador] = useState("2");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load list ─────────────────────────────────────────────────────────────
  const loadFeriados = useCallback(async () => {
    if (!empresaId) return;
    setLoadingList(true);
    try {
      const data = await getFeriados(empresaId);
      setFeriados(data);
    } catch (err) {
      console.error("Error cargando feriados:", err);
    } finally {
      setLoadingList(false);
    }
  }, [empresaId]);

  useEffect(() => {
    loadFeriados();
  }, [loadFeriados]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fecha) {
      setFormError("Seleccioná una fecha.");
      return;
    }
    if (fecha < todayLocal()) {
      setFormError("La fecha debe ser hoy o posterior.");
      return;
    }
    if (!descripcion.trim()) {
      setFormError("Ingresá una descripción.");
      return;
    }
    const mult = parseFloat(multiplicador);
    if (isNaN(mult) || mult <= 0) {
      setFormError("El multiplicador debe ser un número mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      await createFeriado(empresaId, {
        fecha,
        descripcion: descripcion.trim(),
        multiplicador: mult,
      });

      // Reset form
      setFecha("");
      setDescripcion("");
      setMultiplicador("2");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      await loadFeriados();
    } catch (err: any) {
      console.error("Error guardando feriado:", err);

      // Detect duplicate date: server returns 409 or message includes "Ya existe"
      if (
        err?.code === "409" ||
        err?.message?.toLowerCase().includes("ya existe") ||
        err?.message?.includes("duplicate") ||
        err?.message?.includes("unique")
      ) {
        setFormError(
          `Ya existe un feriado cargado para el ${formatFechaCorta(fecha)}. Eliminalo primero si querés modificarlo.`
        );
      } else {
        setFormError("Error al guardar el feriado. Intentá de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este feriado?")) return;
    setDeletingId(id);
    try {
      await deleteFeriado(id);
      setFeriados((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Error eliminando feriado:", err);
      alert("No se pudo eliminar el feriado. Intentá de nuevo.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#FFF4EC] flex items-center justify-center flex-shrink-0">
          <CalendarDays className="w-4 h-4 text-[#F97316]" strokeWidth={1.75} />
        </div>
        <div>
          <h2
            className="text-[#1A1A1A] leading-tight"
            style={{ fontSize: "1.0625rem", fontWeight: 600 }}
          >
            Feriados y días especiales
          </h2>
          <p
            className="text-[#1A1A1A]/45 leading-tight mt-0.5"
            style={{ fontSize: "0.75rem" }}
          >
            Los feriados aplican un multiplicador al sueldo del día automáticamente.
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSave} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          {/* Fecha */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              min={todayLocal()}
              onChange={(e) => {
                setFecha(e.target.value);
                setFormError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>

          {/* Descripción */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Descripción
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setFormError(null);
              }}
              placeholder="Ej: Día del trabajador"
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/25 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>

          {/* Multiplicador */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Multiplicador
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 pointer-events-none">
                ×
              </span>
              <input
                type="number"
                value={multiplicador}
                onChange={(e) => {
                  setMultiplicador(e.target.value);
                  setFormError(null);
                }}
                min="0.1"
                step="0.5"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
                style={{ fontSize: "0.9375rem", minWidth: "90px" }}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {formError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-red-600" style={{ fontSize: "0.8125rem" }}>
              {formError}
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors disabled:opacity-50"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : saveOk ? (
              <>
                <Check className="w-4 h-4" />
                Guardado
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Guardar feriado
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 my-5" />

      {/* ── List ── */}
      <div>
        <p
          className="text-[#1A1A1A]/50 mb-3"
          style={{ fontSize: "0.8125rem", fontWeight: 500 }}
        >
          Feriados cargados (próximos)
        </p>

        {loadingList ? (
          <div className="flex items-center gap-2 py-6 text-[#1A1A1A]/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span style={{ fontSize: "0.875rem" }}>Cargando…</span>
          </div>
        ) : feriados.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarDays className="w-8 h-8 text-[#1A1A1A]/15 mx-auto mb-2" strokeWidth={1.25} />
            <p className="text-[#1A1A1A]/35" style={{ fontSize: "0.875rem" }}>
              No hay feriados cargados para los próximos días.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th
                    className="text-left text-[#1A1A1A]/45 pb-2.5 pr-4"
                    style={{ fontSize: "0.75rem", fontWeight: 500 }}
                  >
                    Fecha
                  </th>
                  <th
                    className="text-left text-[#1A1A1A]/45 pb-2.5 pr-4"
                    style={{ fontSize: "0.75rem", fontWeight: 500 }}
                  >
                    Descripción
                  </th>
                  <th
                    className="text-center text-[#1A1A1A]/45 pb-2.5 pr-4"
                    style={{ fontSize: "0.75rem", fontWeight: 500 }}
                  >
                    Multiplicador
                  </th>
                  <th className="pb-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {feriados.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group"
                  >
                    {/* Fecha */}
                    <td className="py-3 pr-4">
                      <div>
                        <span
                          className="text-[#1A1A1A]"
                          style={{ fontSize: "0.875rem", fontWeight: 500 }}
                        >
                          {formatFechaCorta(f.fecha)}
                        </span>
                        <span
                          className="block text-[#1A1A1A]/40"
                          style={{ fontSize: "0.6875rem" }}
                        >
                          {formatFechaLarga(f.fecha)}
                        </span>
                      </div>
                    </td>

                    {/* Descripción */}
                    <td className="py-3 pr-4">
                      <span
                        className="text-[#1A1A1A]/75"
                        style={{ fontSize: "0.875rem" }}
                      >
                        {f.descripcion}
                      </span>
                    </td>

                    {/* Multiplicador */}
                    <td className="py-3 pr-4 text-center">
                      <span
                        className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#FFF4EC] text-[#F97316]"
                        style={{ fontSize: "0.8125rem", fontWeight: 700 }}
                      >
                        ×{f.multiplicador % 1 === 0 ? f.multiplicador.toFixed(0) : f.multiplicador}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={deletingId === f.id}
                        title="Eliminar feriado"
                        className="p-1.5 rounded-lg text-[#1A1A1A]/25 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deletingId === f.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}