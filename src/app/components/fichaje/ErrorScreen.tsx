import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { ClockHelp } from "./ClockHelp";

interface ErrorScreenProps {
  message: string;
  onBack: () => void;
}

export function ErrorScreen({ message, onBack }: ErrorScreenProps) {
  return (
    <div
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center"
      >
        <AlertTriangle className="w-10 h-10 text-amber-500" strokeWidth={2} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mt-8"
      >
        <h1
          className="text-[#1A1A1A]"
          style={{ fontSize: "1.5rem", fontWeight: 700 }}
        >
          {message}
        </h1>

        <p
          className="text-[#1A1A1A]/50 mt-3 max-w-[280px] mx-auto"
          style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
        >
          Si hay un error, avisale a tu encargado.
        </p>
      </motion.div>

      <button
        onClick={onBack}
        className="mt-10 w-full max-w-xs py-4 rounded-[10px] bg-[#1A1A1A] text-white transition-colors hover:bg-[#333] active:bg-[#444]"
        style={{ fontSize: "1.0625rem", fontWeight: 600, minHeight: 56 }}
      >
        Volver
      </button>
      <div className="mt-4"><ClockHelp errorMessage={message} /></div>
    </div>
  );
}
