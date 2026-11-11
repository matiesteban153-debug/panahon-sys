import { usePWA } from '../../hooks/usePWA';
import { Download, Check, Smartphone } from 'lucide-react';

export function PWAStatus() {
  const { isInstallable, isInstalled, isStandalone, promptInstall } = usePWA();

  if (!isInstallable && !isInstalled && !isStandalone) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-[#F97316]" />
        Aplicación Móvil
      </h3>

      {isStandalone ? (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900 mb-1">
              App instalada correctamente
            </p>
            <p className="text-sm text-green-700">
              Estás usando Panahon como aplicación instalada. Tendrás acceso rápido incluso sin conexión.
            </p>
          </div>
        </div>
      ) : isInstallable ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Instala Panahon como aplicación en tu dispositivo para un acceso más rápido y la capacidad de trabajar sin conexión.
          </p>
          <button
            onClick={promptInstall}
            className="w-full flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea580c] text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            Instalar Aplicación
          </button>
          <p className="text-xs text-gray-500 text-center">
            La instalación es completamente gratuita y no consume espacio adicional
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <Smartphone className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              Disponible como aplicación
            </p>
            <p className="text-sm text-gray-600">
              Puedes instalar Panahon desde el menú de tu navegador para un acceso más rápido.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Beneficios de la app instalada:
        </h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <span>Acceso rápido desde el escritorio o pantalla de inicio</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <span>Funciona sin conexión a internet</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <span>Experiencia nativa como cualquier app móvil</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <span>Notificaciones push (próximamente)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
