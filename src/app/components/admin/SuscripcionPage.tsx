import {
  Check,
  CreditCard,
  Calendar,
  ShieldCheck,
  Users,
  Zap,
  Clock,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useEmpresaSuscripcion, type EmpresaSuscripcion } from "../../lib/use-empresa-suscripcion";
import { SubscriptionNotice } from "./SubscriptionNotice";
import { Button } from "../ui/button";

// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_PRICE_ARS = 30000;
const TRIAL_DAYS = 7;
import { useCheckout } from "../../lib/use-checkout";

const FEATURES = [
  { icon: Users,        text: "Empleados ilimitados" },
  { icon: Zap,          text: "Fichaje por QR en tiempo real" },
  { icon: Clock,        text: "Reportes exportables (PDF / Excel)" },
  { icon: ShieldCheck,  text: "Panel de alertas y seguridad" },
  { icon: Calendar,     text: "Historial completo de registros" },
  { icon: CreditCard,   text: "Soporte prioritario" },
];

// ── Date helpers ───────────────────────────────────────────────────────────

function formatDate(d: Date) {
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Days between now and a future date (ceiling) */
function daysUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Subscription state derivation ──────────────────────────────────────────

type PlanState = "trial" | "active" | "expired" | "loading";

function derivePlanState(empresa: EmpresaSuscripcion | null): {
  state: PlanState;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  trialProgress: number; // 0–100
} {
  if (!empresa) {
    return { state: "loading", trialEndsAt: null, trialDaysLeft: 0, trialProgress: 0 };
  }

  const expiry = empresa.fecha_vencimiento ? new Date(empresa.fecha_vencimiento) : null;
  const validExpiry = expiry && Number.isFinite(expiry.getTime()) ? expiry : null;
  const now = new Date();
  const expired = empresa.exento_pago !== true && validExpiry !== null && validExpiry <= now;
  if (!empresa.plan_activo || expired) {
    return { state: "expired", trialEndsAt: null, trialDaysLeft: 0, trialProgress: 100 };
  }
  if (empresa.exento_pago !== true && empresa.plan_estado === "trial" && validExpiry) {
    const trialDaysLeft = daysUntil(validExpiry);
    const trialProgress = Math.max(0, Math.min(100, Math.round(((TRIAL_DAYS - trialDaysLeft) / TRIAL_DAYS) * 100)));
    return { state: "trial", trialEndsAt: validExpiry, trialDaysLeft, trialProgress };
  }
  return { state: "active", trialEndsAt: null, trialDaysLeft: 0, trialProgress: 100 };
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: PlanState }) {
  if (state === "trial") return (
    <span className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-900">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
      Período de prueba
    </span>
  );
  if (state === "active") return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Plan activo
    </span>
  );
  if (state === "expired") return (
    <span className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 dark:border-red-900">
      <X className="w-3 h-3" />
      Sin plan activo
    </span>
  );
  return null;
}

// ── Main export ────────────────────────────────────────────────────────────

export function SuscripcionContent({ embedded = false }: { embedded?: boolean }) {
  const { admin } = useAuth();
  const subscription = useEmpresaSuscripcion(admin?.empresa_id);
  const { empresa, isLoading, fetchError, canCheckout, reload, hasLinkedSubscription } = subscription;

  const { state, trialEndsAt, trialDaysLeft, trialProgress } =
    derivePlanState(empresa);

  const canOpenCheckout = canCheckout || subscription.canResumeCheckout;
  const { openCheckout, busy, error: checkoutError } = useCheckout(admin?.empresa_id, canOpenCheckout);

  return (
    <div className={embedded ? "space-y-5" : "min-h-full bg-gray-50 px-4 py-8 dark:bg-zinc-950 md:py-10"}>
      <div className={embedded ? "space-y-5" : "mx-auto max-w-2xl space-y-5"}>

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Suscripción
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {empresa?.nombre ?? "Administrá tu plan y facturación"}
            </p>
          </div>
          {!isLoading && <StatusBadge state={state} />}
        </div>

        <SubscriptionNotice subscription={subscription} />
        {canCheckout && <p className="text-sm text-gray-500">Para nuevas altas: $30.000 por mes desde la fecha de suscripción, sin ajuste proporcional al día 10. Revisá el primer cobro antes de confirmar en Mercado Pago.</p>}
        {checkoutError && <p role="alert" className="text-red-600">{checkoutError}</p>}
        {state === "active" && subscription.canResumeCheckout && <Button onClick={openCheckout} disabled={busy}>Continuar suscripción pendiente</Button>}

        {/* ── Trial status card ── */}
        {state === "trial" && trialEndsAt && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            {/* orange top bar */}
            <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-500" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
                    Período de prueba gratuita
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {trialDaysLeft}
                    <span className="text-lg font-medium text-gray-400 dark:text-gray-500 ml-1">
                      {trialDaysLeft === 1 ? "día restante" : "días restantes"}
                    </span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-1.5">
                <div className="h-2 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${trialProgress}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-5">
                <span>Inicio del trial</span>
                <span>Vence el {formatDate(trialEndsAt)}</span>
              </div>

              {/* CTA */}
              {canOpenCheckout && <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Activá tu suscripción mensual
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatARS(PLAN_PRICE_ARS)}/mes. Revisá la fecha y el importe antes de confirmar en Mercado Pago.
                  </p>
                </div>
                <Button
                  onClick={openCheckout}
                  disabled={busy}
                  className="shrink-0 bg-orange-500 text-white hover:bg-orange-600"
                >
                  {busy ? "Preparando…" : subscription.canResumeCheckout ? "Continuar suscripción pendiente" : "Suscribirme ahora"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>}
            </div>
          </div>
        )}

        {/* ── Active plan card ── */}
        {state === "active" && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            <div className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    Plan activo
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    Acceso habilitado
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {empresa?.exento_pago ? "Esta empresa está exenta de pago." : "Consultá las próximas fechas de cobro en Mercado Pago."}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Expired / no plan ── */}
        {state === "expired" && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-100 dark:border-red-900/40 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                    Sin plan activo
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    Tu período de prueba finalizó
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {canCheckout ? "Suscribite para seguir usando Panahon" : "Consultá el estado de tu suscripción con el soporte de Panahon"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              </div>
              {canOpenCheckout && <Button
                onClick={openCheckout}
                  disabled={busy}
                className="w-full bg-orange-500 text-white hover:bg-orange-600"
              >
                {busy ? "Preparando…" : subscription.canResumeCheckout ? "Continuar suscripción pendiente" : "Activar suscripción"}
                <ChevronRight className="w-4 h-4" />
              </Button>}
            </div>
          </div>
        )}

        {/* ── Plan details ── */}
        {!isLoading && !fetchError && !empresa?.exento_pago && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Plan Basic</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatARS(PLAN_PRICE_ARS)} / mes</p>
              </div>
            </div>

            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-orange-500" />
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Billing info ── */}
        {!isLoading && !fetchError && !empresa?.exento_pago && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Facturación</p>
            </div>

            {/* Next charge row */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fecha de cobro
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                  Confirmada por Mercado Pago
                </p>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatARS(PLAN_PRICE_ARS)}
              </span>
            </div>

            {/* Billing day info */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800">
              <RefreshCw className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ciclo de facturación</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                  Mensual, según las condiciones confirmadas en Mercado Pago
                </p>
              </div>
            </div>

            {/* Payment method */}
            <div className="px-5 py-4 flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Método de pago</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5 italic">
                  Gestionado por Mercado Pago
                </p>
              </div>
              {state === "active" && !hasLinkedSubscription && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={reload}
                >
                  Volver a comprobar estado
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/** Legacy standalone route. The same content is embedded in Configuración. */
export function SuscripcionPage() {
  return <SuscripcionContent />;
}
