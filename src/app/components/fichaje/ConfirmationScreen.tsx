import { useEffect } from "react";
import { Check, LogOut } from "lucide-react";
import { motion } from "motion/react";

interface ConfirmationScreenProps {
  type: "entry" | "exit";
  time: string;
  employeeName: string;
  hoursWorked?: string;
  onDone: () => void;
}

export function ConfirmationScreen({
  type,
  time,
  employeeName,
  hoursWorked,
  onDone,
}: ConfirmationScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const isEntry = type === "entry";

  return (
    <div
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      onClick={onDone}
    >
      {/* Animated check icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className={`w-20 h-20 rounded-full flex items-center justify-center ${
          isEntry ? "bg-[#22C55E]" : "bg-[#F97316]"
        }`}
      >
        {isEntry ? (
          <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
        ) : (
          <LogOut className="w-9 h-9 text-white" strokeWidth={2} />
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mt-8"
      >
        <h1
          className="text-[#1A1A1A]"
          style={{ fontSize: "1.75rem", fontWeight: 700 }}
        >
          {isEntry ? "¡Entrada registrada!" : "¡Salida registrada!"}
        </h1>

        <p
          className="text-[#1A1A1A]/50 mt-3"
          style={{ fontSize: "1.125rem" }}
        >
          {time} hs
        </p>

        {!isEntry && hoursWorked && (
          <div className="mt-4 px-5 py-3 bg-[#FFF4EC] rounded-xl inline-block">
            <p
              className="text-[#F97316]"
              style={{ fontSize: "0.9375rem", fontWeight: 600 }}
            >
              Hoy trabajaste {hoursWorked}
            </p>
          </div>
        )}

        <p
          className="text-[#1A1A1A]/70 mt-4"
          style={{ fontSize: "1rem", fontWeight: 500 }}
        >
          {employeeName}
        </p>

        <p
          className="text-[#1A1A1A]/35 mt-6"
          style={{ fontSize: "0.875rem" }}
        >
          {isEntry
            ? "Podés cerrar esta pantalla"
            : "Hasta mañana 👋"}
        </p>
      </motion.div>
    </div>
  );
}
