import { useState } from "react";
import { Check, Loader2, Scale, ShieldCheck } from "lucide-react";

interface TermsWallProps {
  onAccept: () => Promise<void>;
}

/**
 * Non-dismissible compliance gate. It intentionally has no overlay click,
 * Escape-key or close-button handler: acceptance is required to enter admin.
 */
export function TermsWall({ onAccept }: TermsWallProps) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!accepted || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAccept();
    } catch (err) {
      console.error("[TermsWall] No se pudo registrar la aceptación:", err);
      setError("No pudimos registrar tu aceptación. Revisá tu conexión e intentá nuevamente.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="terms-wall-title">
      <section className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
        </div>

        <h1 id="terms-wall-title" className="text-xl font-bold tracking-[-0.015em] text-slate-900 sm:text-2xl">
          Actualización de Términos y Privacidad
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Para seguir utilizando Panahon y cumplir con las normativas de protección de datos, es necesario que leas y aceptes nuestros nuevos Términos y Condiciones y la Política de Privacidad.
        </p>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <a href="/privacidad?tab=terminos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 hover:underline">
            <Scale className="h-4 w-4" />Ver Términos y Condiciones
          </a>
          <a href="/privacidad" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 hover:underline">
            <ShieldCheck className="h-4 w-4" />Ver Política de Privacidad
          </a>
        </div>

        <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-orange-200">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange-600 focus:ring-orange-500"
          />
          <span className="text-sm leading-5 text-slate-700">
            He leído y acepto los Términos y Condiciones y la Política de Privacidad de Panahon.
          </span>
        </label>

        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}

        <button
          type="button"
          onClick={handleAccept}
          disabled={!accepted || saving}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</> : <><Check className="h-4 w-4" />Aceptar y Continuar</>}
        </button>
      </section>
    </div>
  );
}
