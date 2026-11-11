import { AlertCircle } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay - no clickeable */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-[#1A1A1A]" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
                Tu sesión está por expirar
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[#1A1A1A]/70 mb-4" style={{ fontSize: "0.9375rem" }}>
            No detectamos actividad en tu cuenta. ¿Querés continuar trabajando?
          </p>
          
          {/* Countdown */}
          <div className="flex items-center justify-center py-6 px-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-900" style={{ fontSize: "0.875rem" }}>
              Tu sesión se cerrará en{' '}
              <span className="font-bold text-amber-600" style={{ fontSize: "1.5rem" }}>
                {remainingSeconds}
              </span>
              {' '}segundo{remainingSeconds !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/70 hover:bg-white transition-colors"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            Cerrar sesión
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            Continuar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
