import { useState } from "react";
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PanahonLogo } from "../components/PanahonLogo";

type LegalTab = "privacidad" | "terminos";

const sectionTitleClass = "text-[1.0625rem] font-bold tracking-[-0.012em] text-[#1A1A1A]";
const paragraphClass = "text-base leading-7 text-[#4B5563] sm:text-[1.0625rem] sm:leading-8";

export function PrivacidadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<LegalTab>(searchParams.get("tab") === "terminos" ? "terminos" : "privacidad");

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <main className="min-h-screen bg-[#FFFDF9] px-4 py-6 sm:px-6 sm:py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center justify-between">
          <PanahonLogo size="sm" color="orange" />
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#5B4636] transition-colors hover:bg-orange-50 hover:text-[#C9570A] focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        </header>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
          <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50/70 via-white to-white px-6 py-9 sm:px-10 sm:py-11">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-[#D95F0A]">
              {activeTab === "privacidad" ? <ShieldCheck className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
            </div>
            <h1 className="max-w-xl text-2xl font-bold tracking-[-0.02em] text-[#1A1A1A] sm:text-[2rem]">
              Política de Privacidad y Términos de Uso
            </h1>
            <p className="mt-3 text-sm text-[#7A6555]">Última actualización: Septiembre de 2026</p>
          </div>

          <div className="border-b border-gray-100 px-6 py-4 sm:px-10">
            <div className="inline-flex rounded-xl bg-[#FBF7F2] p-1" role="tablist" aria-label="Documentos legales">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "privacidad"}
                onClick={() => setActiveTab("privacidad")}
                className={`rounded-lg px-3 py-2 text-sm transition-colors sm:px-4 ${activeTab === "privacidad" ? "bg-white font-semibold text-[#C9570A] shadow-sm" : "font-medium text-[#7A6555] hover:text-[#3C2C20]"}`}
              >
                Política de Privacidad
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "terminos"}
                onClick={() => setActiveTab("terminos")}
                className={`rounded-lg px-3 py-2 text-sm transition-colors sm:px-4 ${activeTab === "terminos" ? "bg-white font-semibold text-[#C9570A] shadow-sm" : "font-medium text-[#7A6555] hover:text-[#3C2C20]"}`}
              >
                Términos y Condiciones
              </button>
            </div>
          </div>

          <div className="px-6 py-10 sm:px-10 sm:py-12">
            {activeTab === "privacidad" ? <PrivacyContent /> : <TermsContent />}
          </div>
        </section>

        <p className="px-2 py-6 text-center text-xs leading-5 text-[#8C7A6B]">
          Panahon · Software de gestión de asistencia para equipos gastronómicos.
        </p>
      </div>
    </main>
  );
}

function PrivacyContent() {
  return (
    <article role="tabpanel" className="space-y-10">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#D95F0A]">Política de Privacidad</p>
        <p className={paragraphClass}>Esta política describe cómo Panahon trata los datos personales al prestar su servicio de gestión de asistencia laboral.</p>
      </div>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>1. Responsable del Tratamiento</h3>
        <p className={paragraphClass}>Panahon (en adelante, "la Plataforma") opera como un servicio de software como servicio (SaaS) multi-empresa destinado a la gestión de asistencia laboral. La empresa o PyME que contrata el servicio actúa como responsable principal de los datos de sus empleados, siendo Panahon el encargado del tratamiento técnico de los datos.</p>
      </section>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>2. Datos que Recopilamos</h3>
        <p className={paragraphClass}>Para cumplir con la funcionalidad de control de asistencia, recopilamos:</p>
        <ul className="space-y-3 pl-1 text-base leading-7 text-[#4B5563] sm:text-[1.0625rem] sm:leading-8">
          <li className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" /><span><strong className="font-semibold text-[#374151]">Datos de identificación laboral:</strong> Nombre completo, correo electrónico y perfil asignado por la empresa.</span></li>
          <li className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" /><span><strong className="font-semibold text-[#374151]">Registros de asistencia:</strong> Fechas, horarios de entrada y salida, y estado de los turnos.</span></li>
          <li className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" /><span><strong className="font-semibold text-[#374151]">Geolocalización (GPS):</strong> Coordenadas de latitud y longitud estrictamente obtenidas en el momento exacto de realizar el fichaje, con el único propósito de validar si el empleado se encuentra dentro del radio de la geovalla configurada por su empleador. Panahon no realiza un rastreo ni seguimiento continuo o en segundo plano de la ubicación del empleado.</span></li>
        </ul>
      </section>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>3. Almacenamiento y Seguridad</h3>
        <p className={paragraphClass}>Todos los datos son almacenados de forma segura y cifrada en bases de datos alojadas en infraestructura de alta disponibilidad (Supabase / PostgreSQL), cumpliendo con estándares modernos de seguridad informática para evitar accesos no autorizados.</p>
      </section>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>4. Derechos de los Usuarios</h3>
        <p className={paragraphClass}>Los empleados y administradores pueden ejercer sus derechos de acceso, rectificación, actualización o supresión de sus datos personales poniéndose en contacto directamente con el administrador de recursos humanos de su respectiva empresa, o mediante los canales de soporte de Panahon.</p>
      </section>
    </article>
  );
}

function TermsContent() {
  return (
    <article role="tabpanel" className="space-y-10">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#D95F0A]">Términos y Condiciones</p>
        <p className={paragraphClass}>Estas condiciones regulan el uso de la Plataforma por parte de las empresas suscriptoras y sus usuarios autorizados.</p>
      </div>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>1. Aceptación de los Términos</h3>
        <p className={paragraphClass}>El uso de Panahon implica la aceptación expresa de estos Términos y Condiciones por parte de la empresa suscriptora (el "Tenant") y de sus usuarios autorizados.</p>
      </section>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>2. Uso del Servicio y Responsabilidad Laboral</h3>
        <p className={paragraphClass}>Panahon provee herramientas tecnológicas para el fichaje y cálculo de horas. La administración de las reglas laborales, feriados particulares, tipos de pago y el cumplimiento de las normativas locales de trabajo recaen exclusivamente bajo la responsabilidad de la empresa empleadora.</p>
      </section>

      <section className="space-y-4">
        <h3 className={sectionTitleClass}>3. Suscripciones y Pagos</h3>
        <p className={paragraphClass}>Los planes de servicio se abonan mediante pasarelas de pago integradas (Mercado Pago). La falta de pago o el vencimiento de la suscripción podrá derivar en la suspensión temporal de las funcionalidades operativas de la plataforma hasta la regularización del saldo.</p>
      </section>
    </article>
  );
}
