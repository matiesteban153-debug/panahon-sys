import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, CircleHelp, Copy, LocateFixed, MessageCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { FeatureSpotlight } from "../ui/feature-spotlight";

interface ClockHelpProps {
  gpsStatus?: string;
  accuracy?: number;
  errorMessage?: string;
}

const solutions = [
  {
    id: "range",
    icon: LocateFixed,
    title: "Me sale error de ‘Fuera de rango’",
    hint: "Mejorá la señal de tu GPS",
    steps: ["Activá la ubicación precisa para tu navegador en los ajustes del celular.", "Acercate a una ventana o al exterior del local. En interiores, el GPS puede ubicarte más lejos de donde estás.", "Volvé al fichaje, tocá ‘Actualizar ubicación’ y probá de nuevo."],
  },
  {
    id: "cache",
    icon: RefreshCw,
    title: "La app no se actualiza o se queda tildada",
    hint: "Recargá y probá otra vez",
    steps: ["Deslizá la página hacia abajo para recargar. Si no funciona en tu PWA, abrí el enlace en Chrome o Safari y tocá Recargar.", "Si sigue igual, abrí el enlace de fichaje en una pestaña de incógnito o privada. Esto usa una sesión nueva sin borrar tus datos ni la caché de la app instalada."],
  },
  {
    id: "permission",
    icon: ShieldCheck,
    title: "El navegador no me pide permiso de ubicación",
    hint: "Revisá los permisos del sitio",
    steps: ["Chrome: tocá el icono junto a la dirección → Permisos → Ubicación → Permitir.", "Safari: abrí el menú de la página junto a la dirección → Configuración del sitio web → Ubicación → Permitir. Los nombres pueden variar según tu versión.", "Si sigue bloqueada, permití la ubicación para el navegador en los ajustes del celular. Después volvé y tocá ‘Detectar ubicación’."],
  },
];

export function ClockHelp({ gpsStatus, accuracy, errorMessage }: ClockHelpProps) {
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copyReport = async () => {
    const statusLabels: Record<string, string> = { loading: "Buscando ubicación", ok: "Ubicación disponible", denied: "Permiso denegado", unavailable: "Ubicación no disponible" };
    const text = [
      "Panahon · Reporte de fichaje",
      `Fecha: ${new Date().toLocaleString("es-AR")}`,
      `Problema: ${errorMessage || "Necesito ayuda para fichar (describir qué pasó)."}`,
      `GPS: ${gpsStatus ? statusLabels[gpsStatus] || gpsStatus : "Sin información en esta pantalla"}`,
      ...(accuracy !== undefined ? [`Precisión GPS: ${Math.round(accuracy)} metros`] : []),
      `Conexión: ${navigator.onLine ? "Conectado" : "Sin conexión"}`,
      `Navegador: ${navigator.userAgent}`,
    ].join("\n");
    setReport(text);
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Dialog.Root onOpenChange={() => { setReport(""); setCopied(false); setCopyFailed(false); }}>
      <div className="max-w-full">
        <FeatureSpotlight featureId="clock-help-v1" title="¡Nueva sección de ayuda!" description="Resolvé problemas de GPS y permisos, o prepará un reporte para tu encargado. Todo desde acá.">
          <Dialog.Trigger className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 py-2 text-left text-orange-800 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <CircleHelp className="size-[18px] shrink-0" />
            <span className="text-xs font-semibold leading-4">¿Problemas para fichar?</span>
          </Dialog.Trigger>
        </FeatureSpotlight>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in motion-reduce:animate-none" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[101] max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:px-7 sm:pb-7">
          <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
          <Dialog.Close aria-label="Cerrar centro de ayuda" className="absolute top-5 right-4 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X className="size-5" /></Dialog.Close>
          <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 sm:mt-4"><CircleHelp className="size-6" strokeWidth={1.6} /></div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-orange-700">CENTRO DE AYUDA</p>
          <Dialog.Title className="pr-10 text-2xl font-bold leading-tight">Volvamos a tu fichaje.</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-slate-600">A veces es solo la señal o un permiso. Probá estas soluciones antes de pedir ayuda.</Dialog.Description>
          <div className="mt-6 mb-2 flex items-center gap-2 text-xs font-medium text-slate-500"><ChevronDown className="size-3.5" /> Elegí lo que te está pasando</div>
          <Accordion type="single" collapsible defaultValue={errorMessage?.toLowerCase().includes("rango") ? "range" : gpsStatus === "denied" ? "permission" : undefined}>
            {solutions.map(({ id, icon: Icon, title, hint, steps }) => (
              <AccordionItem key={id} value={id} className="border-slate-200">
                <AccordionTrigger className="min-h-20 items-center gap-3 py-4 text-slate-900 hover:no-underline [&>svg]:text-slate-500">
                  <span className="flex flex-1 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="size-[18px]" strokeWidth={1.7} /></span><span className="flex flex-col gap-1"><span className="text-sm font-semibold leading-5">{title}</span><span className="text-xs font-normal text-slate-500">{hint}</span></span></span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ol className="flex flex-col gap-3 pl-12">
                    {steps.map((step, index) => <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-semibold text-orange-800">{index + 1}</span><span>{step}</span></li>)}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold">¿Todavía no podés fichar?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Copiá un reporte y envialo a tu encargado por el chat que usan habitualmente.</p>
            <button type="button" onClick={copyReport} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-orange-900 transition-colors hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><MessageCircle className="size-[18px]" /> Avisar a mi administrador <Copy className="ml-1 size-3.5" /></button>
            <div aria-live="polite" className="text-xs leading-relaxed text-slate-600">
              {copied && <p className="mt-3 flex items-start gap-1.5"><Check className="size-4 shrink-0 text-green-700" /> Reporte copiado. Pegalo en tu chat; todavía no se envió.</p>}
              {copyFailed && <p className="mt-3">No pudimos copiarlo automáticamente. Seleccioná el reporte y copialo manualmente.</p>}
            </div>
            {report && <label className="mt-3 block text-xs text-slate-600">Reporte para compartir<textarea readOnly value={report} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" /></label>}
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-500">El reporte no incluye tu ubicación exacta ni el enlace QR.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
