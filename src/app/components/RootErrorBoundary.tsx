import { useRouteError } from "react-router";
import { PanahonLogo } from "./PanahonLogo";
import { RefreshCw, ShieldAlert, Home } from "lucide-react";

export function RootErrorBoundary() {
  const error = useRouteError() as any;
  console.error("[RootErrorBoundary] Error capturado en ruta:", error);

  const errorMsg = error?.message || (typeof error === "string" ? error : "");
  const isInsecureOp =
    errorMsg.includes("insecure") ||
    errorMsg.includes("SecurityError") ||
    errorMsg.includes("storage");

  return (
    <div
      className="min-h-screen bg-[#F4F5F7] dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 text-center flex flex-col items-center">
        <div className="mb-4">
          <PanahonLogo size="sm" color="orange" />
        </div>

        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#F97316] flex items-center justify-center mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {isInsecureOp ? "Restricción del navegador" : "Algo no salió como esperábamos"}
        </h1>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
          {isInsecureOp
            ? "Tu navegador está bloqueando el almacenamiento temporal (suele ocurrir en Modo Privado / Incógnito de Safari o con bloqueo estricto de cookies). Intentá abrir el enlace en una pestaña normal de Safari o Chrome."
            : "Ocurrió un error al cargar la aplicación. Podés recargar la página para reintentar."}
        </p>

        {errorMsg && !isInsecureOp && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800/60 p-2 rounded-lg mb-5 w-full break-all text-left">
            {errorMsg}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar página
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
