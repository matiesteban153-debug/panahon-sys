import { useId, useState, type ReactNode } from "react";
import { CheckCircle2, MapPin, Users, CreditCard, FileText, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";

export interface OnboardingStep {
  id: "terminos" | "geovalla" | "empleado" | "plan";
  label: string;
  description: string;
  icon: ReactNode;
  completed: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  statusLabel?: string;
}

export interface OnboardingChecklistProps {
  terminosAceptados: boolean;
  geovallaCargada: boolean;
  empleadoCargado: boolean;
  planActivo: boolean;
  planLabel?: string;
  onConfigGPS?: () => void;
  onAddEmpleado?: () => void;
  onVerPlanes?: () => void;
  onVerTerminos?: () => void;
  hideWhenComplete?: boolean;
  className?: string;
}

function StepItem({ step, isNext }: { step: OnboardingStep; isNext: boolean }) {
  return (
    <li className={`flex flex-wrap items-start gap-3 rounded-lg p-3 sm:p-4 ${isNext ? "bg-[#FFF4EC] dark:bg-orange-950/30" : ""}`}>
      <div className={`mt-0.5 shrink-0 ${step.completed ? "text-emerald-600 dark:text-emerald-400" : isNext ? "text-[#F97316]" : "text-[#1A1A1A]/40 dark:text-zinc-500"}`}>
        {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
      </div>
      <div className="min-w-0 flex-1 basis-[180px]">
        <p className="text-sm font-semibold leading-snug text-[#1A1A1A] dark:text-zinc-100">{step.label}</p>
        <p className={`mt-1 text-xs leading-relaxed ${step.completed ? "text-emerald-700 dark:text-emerald-400" : "text-[#1A1A1A]/50 dark:text-zinc-400"}`}>
          {step.completed ? step.statusLabel : step.description}
        </p>
      </div>
      {!step.completed && step.ctaLabel && (
        <Button type="button" onClick={step.onCta} disabled={!step.onCta} variant={isNext ? "default" : "outline"}
          className={`ml-8 h-10 w-[calc(100%-2rem)] rounded-lg px-3.5 text-xs font-semibold sm:ml-0 sm:w-auto ${isNext ? "bg-[#F97316] text-white hover:bg-[#E86A0A]" : "border-gray-200 bg-white text-[#1A1A1A]/70 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"} focus-visible:ring-[#F97316]/30`}>
          {step.ctaLabel}<ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}

export default function OnboardingChecklist({
  terminosAceptados, geovallaCargada, empleadoCargado, planActivo, planLabel,
  onConfigGPS, onAddEmpleado, onVerPlanes, onVerTerminos,
  hideWhenComplete = false, className = "",
}: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();
  const steps: OnboardingStep[] = [
    {
      id: "terminos", label: "Aceptar términos y condiciones",
      description: "Revisá los términos de uso de Panahon.",
      icon: <FileText className="h-5 w-5" />, completed: terminosAceptados,
      ctaLabel: "Ver términos", onCta: onVerTerminos, statusLabel: "Términos aceptados",
    },
    {
      id: "geovalla", label: "Configurar la ubicación del local",
      description: "Definí la ubicación y el radio permitido para fichar.",
      icon: <MapPin className="h-5 w-5" />, completed: geovallaCargada,
      ctaLabel: "Configurar geovalla", onCta: onConfigGPS, statusLabel: "Geovalla configurada",
    },
    {
      id: "empleado", label: "Agregar el primer empleado",
      description: "Sumá a tu equipo para empezar a registrar asistencias.",
      icon: <Users className="h-5 w-5" />, completed: empleadoCargado,
      ctaLabel: "Agregar empleado", onCta: onAddEmpleado, statusLabel: "Empleados activos",
    },
    {
      id: "plan", label: "Verificar el plan activo",
      description: "Revisá tu suscripción y las opciones de pago.",
      icon: <CreditCard className="h-5 w-5" />, completed: planActivo,
      ctaLabel: "Ver suscripción", onCta: onVerPlanes, statusLabel: planLabel ?? "Plan activo",
    },
  ];
  const completedCount = steps.filter((step) => step.completed).length;
  const pct = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;
  const nextStepIndex = steps.findIndex((step) => !step.completed);

  if (hideWhenComplete && allComplete) return null;

  return (
    <Card className={`gap-0 overflow-hidden rounded-xl border-gray-100 bg-white text-[#1A1A1A] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${className}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Primeros pasos</h2>
            <p className="mt-1 text-sm text-[#1A1A1A]/50 dark:text-zinc-400">
              {allComplete ? "Tu local está listo para empezar a fichar." : "Terminá de configurar tu local para empezar a usar Panahon."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir primeros pasos" : "Contraer primeros pasos"}
            aria-expanded={!collapsed} aria-controls={contentId}
            className="rounded-lg text-[#1A1A1A]/40 hover:bg-gray-50 dark:text-zinc-500 dark:hover:bg-zinc-800 focus-visible:ring-[#F97316]/30">
            {collapsed ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={pct} aria-label="Progreso de configuración" className="h-1.5 bg-gray-100 dark:bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-[#F97316] [&_[data-slot=progress-indicator]]:duration-500 motion-reduce:[&_[data-slot=progress-indicator]]:transition-none" />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[#F97316]">{completedCount} de {steps.length}</span>
        </div>
      </div>
      <div id={contentId} hidden={collapsed} className="border-t border-gray-100 p-2 sm:p-3 dark:border-zinc-800">
        <ul className="space-y-1">
          {steps.map((step, index) => <StepItem key={step.id} step={step} isNext={index === nextStepIndex} />)}
        </ul>
      </div>
    </Card>
  );
}
