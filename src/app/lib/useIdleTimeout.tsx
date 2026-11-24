import { useEffect, useRef, useState, useCallback } from "react";

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  initialIdleTime?: number; // Tiempo inicial de inactividad (5 minutos por defecto)
  extendedIdleTime?: number; // Tiempo de inactividad al extender (10 minutos por defecto)
  warningDuration?: number; // Duración en segundos que permanece visible el cartel (10 minutos = 600s por defecto)
  enabled?: boolean;
}

/**
 * Hook para gestionar el timeout de inactividad:
 * 1. Espera 5 minutos iniciales de inactividad.
 * 2. Muestra un cartel de advertencia que dura 10 minutos con cuenta regresiva.
 * 3. Si el usuario elige "Mantener sesión", se extiende por 10 minutos adicionales (y se repite cada 10m si no hay interacción).
 * 4. Si el usuario elige "Cerrar sesión" o el cartel expira (10m sin responder), se cierra la sesión automáticamente.
 */
export function useIdleTimeout({
  onIdle,
  initialIdleTime = 5 * 60 * 1000, // 5 minutos
  extendedIdleTime = 10 * 60 * 1000, // 10 minutos al extender
  warningDuration = 10 * 60, // 10 minutos (600 segundos) de duración del cartel
  enabled = true,
}: UseIdleTimeoutOptions) {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(warningDuration);

  // Guarda el intervalo activo: empieza en 5m, y si extiende pasa a 10m
  const currentIdleTimeRef = useRef(initialIdleTime);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const triggerLogout = useCallback(() => {
    clearAllTimers();
    setIsWarningVisible(false);
    onIdleRef.current();
  }, [clearAllTimers]);

  const startWarningCountdown = useCallback(() => {
    setIsWarningVisible(true);
    setRemainingSeconds(warningDuration);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    const startTime = Date.now();
    const endTime = startTime + warningDuration * 1000;

    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.round((endTime - now) / 1000));
      setRemainingSeconds(left);

      if (left <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        triggerLogout();
      }
    }, 1000);
  }, [warningDuration, triggerLogout]);

  const resetIdleTimer = useCallback(() => {
    if (isWarningVisible) return; // Si el cartel ya está abierto, solo responde a sus botones

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, currentIdleTimeRef.current);
  }, [isWarningVisible, startWarningCountdown]);

  // Handler cuando el usuario hace clic en "Mantener sesión"
  const continueSession = useCallback(() => {
    clearAllTimers();
    setIsWarningVisible(false);
    // Para las siguientes comprobaciones, se mantiene en 10 minutos
    currentIdleTimeRef.current = extendedIdleTime;
    setRemainingSeconds(warningDuration);

    timeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, extendedIdleTime);
  }, [clearAllTimers, extendedIdleTime, warningDuration, startWarningCountdown]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setIsWarningVisible(false);
      return;
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    const handleUserActivity = () => {
      if (!isWarningVisible) {
        resetIdleTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Iniciar temporizador
    resetIdleTimer();

    return () => {
      clearAllTimers();
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [enabled, isWarningVisible, resetIdleTimer, clearAllTimers]);

  return {
    isWarningVisible,
    remainingSeconds,
    continueSession,
    logout: triggerLogout,
  };
}
