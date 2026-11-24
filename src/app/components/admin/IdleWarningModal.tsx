import { AlertCircle, Clock } from 'lucide-react';

interface IdleWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onContinue: () => void;
  onLogout: () => void;
}

export function IdleWarningModal({
  isOpen,
  remainingSeconds,
  onContinue,
  onLogout,
}: IdleWarningModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
                ¿Deseás mantener la sesión abierta?
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[#1A1A1A]/70 dark:text-zinc-400 mb-4 leading-relaxed" style={{ fontSize: "0.9375rem" }}>
            No detectamos actividad en tu cuenta. Podés mantener la sesión abierta por 10 minutos más o cerrarla en este momento.
          </p>
          
          {/* Countdown display */}
          <div className="flex flex-col items-center justify-center py-5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs font-medium mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>La sesión se cerrará automáticamente en:</span>
            </div>
            <p className="font-bold text-amber-600 dark:text-amber-400 text-3xl tracking-wider font-mono">
              {formattedTime}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-[#1A1A1A]/70 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 py-2.5 rounded-xl bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC6A0A] transition-colors shadow-sm"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            Mantener sesión abierta
          </button>
        </div>
      </div>
    </div>
  );
}
