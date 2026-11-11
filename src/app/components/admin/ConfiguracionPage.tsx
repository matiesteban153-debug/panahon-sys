import { useState, useEffect, useCallback, useRef } from "react";
import { Building2, CalendarDays, Check, ChevronRight, CreditCard, Download, Loader2, MapPinned, QrCode, Settings2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "react-router";
import { useAuth } from "../../lib/auth-context";
import { getEmpresa, updateEmpresa, getEmployees } from "../../lib/api";
import { FeriadosSection } from "./FeriadosSection";
import { UbicacionSection } from "./UbicacionSection";
import { SuscripcionContent } from "./SuscripcionPage";

type SettingsTab = "empresa" | "tarifas" | "geovalla" | "qr" | "suscripcion";

const tabs: { id: SettingsTab; label: string; description: string; icon: typeof Building2 }[] = [
  { id: "empresa", label: "Empresa", description: "Datos del local", icon: Building2 },
  { id: "tarifas", label: "Tarifas", description: "Parámetros de jornada", icon: Settings2 },
  { id: "geovalla", label: "Geovalla", description: "Ubicación y GPS", icon: MapPinned },
  { id: "qr", label: "Acceso QR", description: "Punto de fichaje", icon: QrCode },
  { id: "suscripcion", label: "Suscripción", description: "Plan y facturación", icon: CreditCard },
];

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[#1A1A1A] outline-none transition-colors placeholder:text-[#1A1A1A]/25 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20";

export function ConfiguracionPage() {
  const { admin } = useAuth();
  const empresaId = admin?.empresa_id || "";
  const qrRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("seccion");
  const initialTab: SettingsTab = tabs.find((tab) => tab.id === requestedTab)?.id ?? "empresa";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  useEffect(() => {
    setActiveTab(tabs.find((tab) => tab.id === requestedTab)?.id ?? "empresa");
  }, [requestedTab]);
  const [companyName, setCompanyName] = useState("");
  const [rubro, setRubro] = useState("gastronomia");
  const [contactEmail, setContactEmail] = useState("");
  const [defaultRate, setDefaultRate] = useState("3000");
  const [defaultShift, setDefaultShift] = useState("8");
  const [plan, setPlan] = useState("base");
  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SettingsTab | null>(null);
  const [savedTab, setSavedTab] = useState<SettingsTab | null>(null);
  const [toast, setToast] = useState("");
  const [employeeCount, setEmployeeCount] = useState(0);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoRadio, setGeoRadio] = useState<number | null>(null);

  const fichajeUrl = qrToken ? `${window.location.origin}/fichaje?empresa=${qrToken}` : "";

  const fetchConfig = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [empresa, emps] = await Promise.all([getEmpresa(empresaId), getEmployees(empresaId)]);
      if (empresa) {
        setCompanyName(empresa.nombre || "");
        setRubro(empresa.rubro || "gastronomia");
        setContactEmail(empresa.email_contacto || admin?.email || "");
        setDefaultRate(String(empresa.valor_hora_default || 3000));
        setDefaultShift(String(empresa.jornada_default || 8));
        setPlan(empresa.plan || "base");
        setQrToken(empresa.qr_token || "");
        setGeoLat(empresa.latitud ?? null);
        setGeoLng(empresa.longitud ?? null);
        setGeoRadio(empresa.radio_metros ?? null);
      }
      setEmployeeCount(emps.length);
    } catch (err) {
      console.error("Error fetching config:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, admin]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (section: SettingsTab) => {
    if (!empresaId || (section !== "empresa" && section !== "tarifas")) return;
    setSaving(section);
    try {
      if (section === "empresa") {
        await updateEmpresa(empresaId, { nombre: companyName, rubro, email_contacto: contactEmail });
      } else {
        await updateEmpresa(empresaId, { valor_hora_default: Number(defaultRate), jornada_default: Number(defaultShift) });
      }
      setSavedTab(section);
      setToast("Cambios guardados");
      window.setTimeout(() => setSavedTab(null), 2200);
      window.setTimeout(() => setToast(""), 2800);
    } catch (err) {
      console.error("Error saving config:", err);
      setToast("No se pudieron guardar los cambios");
      window.setTimeout(() => setToast(""), 3500);
    } finally {
      setSaving(null);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const image = new Image();
    image.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      context?.fillRect(0, 0, 400, 400);
      context?.drawImage(image, 0, 0, 400, 400);
      const link = document.createElement("a");
      link.download = `panahon-qr-${(qrToken || empresaId).slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center px-6"><Loader2 className="h-6 w-6 animate-spin text-[#F97316]" /><span className="ml-3 text-sm text-[#1A1A1A]/50">Cargando configuración…</span></div>;
  }

  const currentTab = tabs.find((tab) => tab.id === activeTab)!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {toast && (
        <div role="status" className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-emerald-700 shadow-xl" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          <Check className="h-4 w-4" />{toast}
        </div>
      )}

      <header className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-[#1A1A1A] dark:text-zinc-50">Configuración</h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/55 dark:text-zinc-400">Ajustá los datos y reglas operativas de {companyName || "tu empresa"}.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#C9570A] sm:self-auto">
          <CalendarDays className="h-3.5 w-3.5" /> {employeeCount} empleados activos
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[235px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Secciones de configuración">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={isActive ? "page" : undefined}
                className={`group flex min-w-[172px] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all lg:min-w-0 ${isActive ? "border-orange-200 bg-orange-50 text-orange-700 shadow-sm" : "border-transparent bg-white text-[#1A1A1A]/65 hover:bg-orange-50 hover:text-[#1A1A1A]"}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? "bg-orange-100" : "bg-gray-100 group-hover:bg-orange-100"}`}><Icon className={`h-4 w-4 ${isActive ? "text-orange-600" : "text-[#F97316]"}`} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tab.label}</span><span className={`mt-0.5 block text-xs ${isActive ? "text-orange-600/70" : "text-[#1A1A1A]/40"}`}>{tab.description}</span></span>
                <ChevronRight className={`hidden h-4 w-4 lg:block ${isActive ? "text-orange-400" : "text-[#1A1A1A]/25"}`} />
              </button>
            );
          })}
        </nav>

        <main className="min-w-0">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-7 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-7 border-b border-gray-100 pb-5 dark:border-zinc-800">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]"><currentTab.icon className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-[#1A1A1A] dark:text-zinc-50">{currentTab.label}</h2><p className="mt-0.5 text-sm text-[#1A1A1A]/50 dark:text-zinc-400">{currentTab.description}</p></div></div>
            </div>

            {activeTab === "empresa" && <div className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Nombre de la empresa</label><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Ej: Restaurante El Rincón" className={inputClass} /></div><div><label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Rubro</label><select value={rubro} onChange={(event) => setRubro(event.target.value)} className={inputClass}><option value="gastronomia">Gastronomía</option><option value="servicios">Servicios</option><option value="construccion">Construcción</option><option value="logistica">Logística</option><option value="comercio">Comercio</option><option value="otro">Otro</option></select></div><div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Email de contacto</label><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputClass} /></div></div><SaveButton active={saving === "empresa"} saved={savedTab === "empresa"} onClick={() => handleSave("empresa")} /></div>}

            {activeTab === "tarifas" && <div className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Valor hora por defecto</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40">$</span><input type="number" value={defaultRate} onChange={(event) => setDefaultRate(event.target.value)} className={`${inputClass} pl-8 pr-14`} /><span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#1A1A1A]/35">/ hora</span></div></div><div><label className="mb-1.5 block text-sm font-medium text-[#1A1A1A]/70">Jornada por defecto</label><select value={defaultShift} onChange={(event) => setDefaultShift(event.target.value)} className={inputClass}><option value="4">4 horas</option><option value="6">6 horas</option><option value="8">8 horas</option><option value="10">10 horas</option></select></div></div><SaveButton active={saving === "tarifas"} saved={savedTab === "tarifas"} onClick={() => handleSave("tarifas")} /><div className="border-t border-gray-100 pt-6"><FeriadosSection empresaId={empresaId} /></div></div>}

            <div className={activeTab === "geovalla" ? "block" : "hidden"}>
              <UbicacionSection empresaId={empresaId} initialLat={geoLat} initialLng={geoLng} initialRadio={geoRadio} />
            </div>

            {activeTab === "qr" && <div className="space-y-6"><div className="grid grid-cols-1 items-center gap-7 md:grid-cols-[210px_minmax(0,1fr)]"><div ref={qrRef} className="mx-auto flex h-[198px] w-[198px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:mx-0">{fichajeUrl ? <QRCodeSVG value={fichajeUrl} size={164} level="M" fgColor="#1A1A1A" bgColor="#FFFFFF" /> : <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />}</div><div className="space-y-4"><div><h3 className="text-base font-semibold text-[#1A1A1A]">Punto de fichaje del local</h3><p className="mt-1 text-sm leading-6 text-[#1A1A1A]/55">Imprimí este código y ubicálo en un punto visible. El equipo podrá registrar entrada y salida desde el celular.</p></div><div className="rounded-xl bg-gray-50 px-3.5 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1A1A1A]/35">URL de fichaje</p><p className="break-all font-mono text-xs text-[#1A1A1A]/65">{fichajeUrl || "Generando…"}</p></div><button onClick={handleDownloadQR} disabled={!fichajeUrl} className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E86A0A] disabled:opacity-50"><Download className="h-4 w-4" />Descargar QR</button></div></div><div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 md:grid-cols-3"><InfoCard label="Plan actual" value={plan === "pro" ? "PRO" : plan === "premium" ? "PREMIUM" : "BASE"} /><InfoCard label="Empleados" value={`${employeeCount} activos`} /><InfoCard label="Administrador" value={admin?.email || "—"} /></div></div>}

            {activeTab === "suscripcion" && <SuscripcionContent embedded />}
          </section>
        </main>
      </div>
      <footer className="mt-8 flex items-center justify-center gap-4 text-xs text-slate-400">
        <a href="/privacidad" className="transition-colors hover:text-orange-600">Política de Privacidad</a>
        <a href="/privacidad?tab=terminos" className="transition-colors hover:text-orange-600">Términos y Condiciones</a>
      </footer>
    </div>
  );
}

function SaveButton({ active, saved, onClick }: { active: boolean; saved: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={active} className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E86A0A] disabled:opacity-50">{active ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</> : saved ? <><Check className="h-4 w-4" />Cambios guardados</> : "Guardar cambios"}</button>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 px-3.5 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#1A1A1A]/35">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#1A1A1A]/75">{value}</p></div>;
}
