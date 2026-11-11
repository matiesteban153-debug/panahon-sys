import { LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../lib/auth-context";

import { useCheckout } from "../../lib/use-checkout";
import { useEmpresaSuscripcion } from "../../lib/use-empresa-suscripcion";
import { SubscriptionNotice } from "./SubscriptionNotice";
import { Button } from "../ui/button";

export function PaywallScreen() {
  const { signOut, admin } = useAuth();
  const navigate = useNavigate();
  const subscription = useEmpresaSuscripcion(admin?.empresa_id);

  const canOpenCheckout = subscription.canCheckout || subscription.canResumeCheckout;
  const { openCheckout, busy, error: checkoutError } = useCheckout(admin?.empresa_id, canOpenCheckout);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#F4F5F7] flex items-center justify-center p-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-[460px] p-10 text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-[#FFF4EC] flex items-center justify-center mx-auto mb-7">
          <LockKeyhole className="w-7 h-7 text-[#F97316]" strokeWidth={1.75} />
        </div>

        {/* Title */}
        <h1
          className="text-[#1A1A1A]"
          style={{
            fontSize: "1.375rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
          }}
        >
          {subscription.canCheckout ? "Tu período de prueba ha finalizado" : "Revisá tu suscripción"}
        </h1>

        {/* Description */}
        <p
          className="mt-4 text-[#1A1A1A]/55"
          style={{ fontSize: "0.9375rem", lineHeight: 1.65 }}
        >
          {subscription.canCheckout
            ? "Esperamos que hayas disfrutado probar Panahon. Para seguir registrando los fichajes y administrar a tu equipo sin interrupciones, por favor activá tu suscripción mensual."
            : "Comprobá la información de tu suscripción antes de continuar. Si ya pagaste y no podés ingresar, contactá al soporte de Panahon."}
        </p>

        {/* Divider */}
        <div className="border-t border-gray-100 my-7" />

        {/* CTA button — matches primary button system */}
        <SubscriptionNotice subscription={subscription} />
        {subscription.canCheckout && <p className="text-sm text-gray-500 mb-4">Cobro mensual desde la fecha de suscripción. Revisá el primer cobro antes de confirmar en Mercado Pago.</p>}
        {checkoutError && <p role="alert" className="text-red-600 my-3">{checkoutError}</p>}
        {canOpenCheckout && <Button
          type="button"
          onClick={openCheckout}
                  disabled={busy}
          className="w-full bg-orange-500 text-white hover:bg-orange-600"
        >
          {busy ? "Preparando…" : subscription.canResumeCheckout ? "Continuar suscripción pendiente" : "Activar plan por $30.000 / mes"}
        </Button>}

        {/* Sign out link */}
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-5 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors underline underline-offset-2"
          style={{ fontSize: "0.8125rem", background: "none", border: "none", cursor: "pointer" }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
