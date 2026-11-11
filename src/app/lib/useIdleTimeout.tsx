import { useEffect, useRef } from "react";

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  idleTime?: number; // milliseconds, default 5 minutes
  enabled?: boolean; // whether the timeout is active
}

/**
 * Hook para detectar inactividad del usuario y ejecutar un callback
 * cuando se alcanza el tiempo límite sin interacción.
 */
export function useIdleTimeout({
  onIdle,
  idleTime = 5 * 60 * 1000, // 5 minutos por defecto
  enabled = true,
}: UseIdleTimeoutOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);

  // Mantener callback actualizado
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) {
      // Si está deshabilitado, limpiar timeout y listeners
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    console.log("[IdleTimeout] Activado, tiempo límite:", idleTime / 1000, "segundos");

    // Iniciar el temporizador
    const resetTimer = () => {
      // Limpiar temporizador anterior si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Crear nuevo temporizador
      timeoutRef.current = setTimeout(() => {
        console.log("[IdleTimeout] Tiempo de inactividad alcanzado, ejecutando callback");
        onIdleRef.current();
      }, idleTime);
    };

    // Eventos de interacción del usuario
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    // Handler para todos los eventos
    const handleUserActivity = () => {
      resetTimer();
    };

    // Registrar listeners
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Iniciar el temporizador por primera vez
    resetTimer();

    // Cleanup: remover listeners y limpiar timeout
    return () => {
      console.log("[IdleTimeout] Limpiando event listeners y timeout");
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, idleTime]);
}
