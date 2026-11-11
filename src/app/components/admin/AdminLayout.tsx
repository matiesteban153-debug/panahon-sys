import { Outlet, useNavigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TrialWarningBanner } from "./TrialWarningBanner";
import { useAuth } from "../../lib/auth-context";
import { loadClient } from "../../lib/supabase";
import { aceptarTerminos, getTerminosAceptados, verificarEstadoEmpresaEmpleado } from "../../lib/api";
import { Loader2 } from "lucide-react";
import { isDemoUser, DEMO_RESTRICTED_PATHS } from "../../lib/demo";
import { TermsWall } from "./TermsWall";

// ─── Trial days helper ─────────────────────────────────────────────────────────

function calcTrialDaysLeft(fechaVencimiento: string): number {
  const msLeft = new Date(fechaVencimiento).getTime() - Date.now();
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { session, loading, admin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [planActivo,    setPlanActivo]    = useState<boolean | null>(null);
  const [exentoPago,    setExentoPago]    = useState<boolean | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [planVencido,   setPlanVencido]   = useState<boolean>(false);
  const [terminosAceptados, setTerminosAceptados] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate("/admin/login", { replace: true });
    }
  }, [loading, session, navigate]);

  // Demo user: silently redirect away from restricted paths
  useEffect(() => {
    if (!admin?.email) return;
    if (!isDemoUser(admin.email)) return;
    const isRestricted = DEMO_RESTRICTED_PATHS.some((path) =>
      location.pathname.startsWith(path)
    );
    if (isRestricted) {
      navigate("/admin", { replace: true });
    }
  }, [admin?.email, location.pathname, navigate]);

  // Fetch empresa subscription fields and verify RPC once admin.empresa_id is available
  useEffect(() => {
    const empresaId = admin?.empresa_id;
    if (!empresaId) return;

    let cancelled = false;

    async function checkSubscriptionStatus() {
      try {
        const client = await loadClient();
        const [{ data: empresaData }, { data: empList }] = await Promise.all([
          client
            .from("empresas")
            .select("plan_activo, exento_pago, fecha_vencimiento")
            .eq("id", empresaId)
            .maybeSingle(),
          client
            .from("empleados")
            .select("id")
            .eq("empresa_id", empresaId)
            .is("deleted_at", null)
            .limit(1),
        ]);

        if (cancelled) return;

        let expiredByEmpresa = false;
        if (empresaData) {
          const activo = empresaData.plan_activo ?? true;
          const exento = empresaData.exento_pago ?? false;
          setPlanActivo(activo);
          setExentoPago(exento);

          if (empresaData.fecha_vencimiento) {
            const daysLeft = calcTrialDaysLeft(empresaData.fecha_vencimiento);
            setTrialDaysLeft(activo ? daysLeft : null);
            if (!exento && daysLeft < 0) {
              expiredByEmpresa = true;
            }
          } else {
            setTrialDaysLeft(null);
          }

          if (!exento && activo === false) {
            expiredByEmpresa = true;
          }
        }

        let expiredByRpc = false;
        const firstEmpleadoId = empList?.[0]?.id;
        if (firstEmpleadoId) {
          const rpcResult = await verificarEstadoEmpresaEmpleado(firstEmpleadoId);
          if (!cancelled && rpcResult.valido === false) {
            expiredByRpc = true;
          }
        }

        if (!cancelled) {
          setPlanVencido(expiredByRpc || expiredByEmpresa);
        }
      } catch {
        // Non-fatal — silently skip banners if fetch fails
      }
    }

    checkSubscriptionStatus();
    return () => {
      cancelled = true;
    };
  }, [admin?.empresa_id, location.pathname]);

  // Silent background check: nothing is shown while it runs. Only an explicit
  // false/null (or a failed query, to fail closed) raises the TermsWall.
  useEffect(() => {
    if (!admin?.empresa_id) return;
    setTerminosAceptados(null);
    getTerminosAceptados(admin.empresa_id)
      .then(setTerminosAceptados)
      .catch((err) => {
        console.error("[TermsWall] Error consultando aceptación:", err);
        setTerminosAceptados(false);
      });
  }, [admin?.empresa_id]);

  // Expired subscription banner: shown when RPC returns valido: false or plan is expired
  const showExpiredPlanBanner = planVencido || (planActivo === false && exentoPago === false);

  // Yellow trial banner: active plan, between 0 and 3 days left until fecha_vencimiento
  const showTrialBanner =
    !showExpiredPlanBanner &&
    planActivo === true &&
    trialDaysLeft !== null &&
    trialDaysLeft >= 0 &&
    trialDaysLeft <= 3;

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#F4F5F7] dark:bg-zinc-950 flex items-center justify-center transition-colors duration-200"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
          <p className="text-[#1A1A1A]/50 dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
            Cargando...
          </p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const aceptarTerminosEmpresa = async () => {
    if (!admin?.empresa_id) throw new Error("Empresa no disponible");
    await aceptarTerminos(admin.empresa_id);
    setTerminosAceptados(true);
  };

  return (
    <div
      className="min-h-screen bg-[#F4F5F7] dark:bg-zinc-950 transition-colors duration-200"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {terminosAceptados === false && <TermsWall onAccept={aceptarTerminosEmpresa} />}

      <Sidebar />
      <BottomNav />
      <main className="lg:ml-[240px] min-h-screen pb-20 lg:pb-0">
        {showExpiredPlanBanner && (
          <div
            role="alert"
            className="sticky top-0 z-50 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 shadow-sm"
            style={{
              background: "#FEF2F2",
              borderBottom: "1.5px solid #EF4444",
            }}
          >
            <p
              className="leading-snug min-w-0"
              style={{ fontSize: "0.875rem", color: "#991B1B", fontWeight: 600 }}
            >
              ⚠️ Tu plan ha caducado. Los empleados no podrán registrar asistencia. Actualiza tu suscripción para reactivar el servicio.
            </p>
            <button
              type="button"
              onClick={() => navigate("/admin/configuracion?seccion=suscripcion")}
              className="shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 transition-colors self-start sm:self-auto"
              style={{
                background: "#DC2626",
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#B91C1C")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#DC2626")}
            >
              Gestionar Plan
            </button>
          </div>
        )}
        {showTrialBanner && <TrialWarningBanner diasRestantes={trialDaysLeft!} />}

        <Outlet context={{ terminosAceptados, planVencido: showExpiredPlanBanner }} />
      </main>
    </div>
  );
}
