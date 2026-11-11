import { useEffect, useState, useCallback, useRef } from 'react';

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  idleTime?: number; // milliseconds
  onWarning?: () => void;
  warningTime?: number; // milliseconds
}

export function useIdleTimeout({
  onIdle,
  idleTime = 14 * 60 * 1000, // 14 minutes
  onWarning,
  warningTime = 14 * 60 * 1000, // 14 minutes (same as idle time to trigger warning)
}: UseIdleTimeoutOptions) {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  
  const idleTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setRemainingSeconds(60);
    
    countdownTimerRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimers();
          onIdle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onIdle, clearTimers]);

  const showWarning = useCallback(() => {
    setIsWarningVisible(true);
    if (onWarning) {
      onWarning();
    }
    startCountdown();
  }, [onWarning, startCountdown]);

  const resetTimer = useCallback(() => {
    clearTimers();
    setIsWarningVisible(false);
    setRemainingSeconds(60);

    // Set warning timer
    warningTimerRef.current = window.setTimeout(() => {
      showWarning();
    }, warningTime);
  }, [clearTimers, warningTime, showWarning]);

  const continueSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      if (!isWarningVisible) {
        resetTimer();
      }
    };

    // Initial timer setup
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      clearTimers();
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isWarningVisible, resetTimer, clearTimers]);

  return {
    isWarningVisible,
    remainingSeconds,
    continueSession,
  };
}