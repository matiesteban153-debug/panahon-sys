import { motion, AnimatePresence } from "motion/react";
import svgPaths from "../../../imports/svg-9dqf0kngaq";

interface SplashScreenProps {
  visible: boolean;
  onExitComplete?: () => void;
}

// Panahon sun-burst mark — all paths, recolored to white
function PanahonMark({ size = 100 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 586.393 586.393"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={svgPaths.p34abd900} fill="white" />
      <path d={svgPaths.p5b24000}  fill="white" />
      <path d={svgPaths.p28e5b280} fill="white" />
      <path d={svgPaths.p27c28f00} fill="white" />
      <path d={svgPaths.p2765f980} fill="white" />
      <path d={svgPaths.p2abcdb00} fill="white" />
      <path d={svgPaths.p4af9c00}  fill="white" />
      <path d={svgPaths.p356e9e80} fill="white" />
      <path d={svgPaths.p481e100}  fill="white" />
      <path d={svgPaths.p3d85c300} fill="white" />
      <path d={svgPaths.p9a5c000}  fill="white" />
      <path d={svgPaths.pfd46b80}  fill="white" />
      <path d={svgPaths.p115dc800} fill="white" />
      <path d={svgPaths.p7673d00}  fill="white" />
      <path d={svgPaths.p1eda2000} fill="white" />
      <path d={svgPaths.p12447c00} fill="white" />
    </svg>
  );
}

export function SplashScreen({ visible, onExitComplete }: SplashScreenProps) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ backgroundColor: "#F97316", fontFamily: "'DM Sans', sans-serif" }}
          // Whole screen: instant in, smooth fade-out
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
        >
          {/* ── Logo mark ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }} // spring-like
          >
            <PanahonMark size={108} />
          </motion.div>

          {/* ── App name ──────────────────────────────────────────────── */}
          <motion.p
            className="text-white font-bold tracking-tight mt-5"
            style={{ fontSize: "2rem", letterSpacing: "-0.03em" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
          >
            Panahon
          </motion.p>

          {/* ── Tagline ───────────────────────────────────────────────── */}
          <motion.p
            className="text-white/70 uppercase tracking-[0.2em] mt-1"
            style={{ fontSize: "0.72rem" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
          >
            Control Horario
          </motion.p>

          {/* ── Subtle pulse ring ─────────────────────────────────────── */}
          <motion.div
            className="absolute rounded-full border border-white/20"
            style={{ width: 200, height: 200 }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{
              delay: 0.4,
              duration: 1.4,
              repeat: Infinity,
              repeatDelay: 0.3,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute rounded-full border border-white/15"
            style={{ width: 200, height: 200 }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{
              delay: 0.7,
              duration: 1.6,
              repeat: Infinity,
              repeatDelay: 0.3,
              ease: "easeOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
