import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { loadClient } from "../lib/supabase";
import { PanahonLogo } from "../components/PanahonLogo";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { session, admin, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState(2); // Empezamos en step 2 (agregar empleado)
  const [checkingEmployees, setCheckingEmployees] = useState(true);
  
  // Form de empleado
  const [nombreEmpleado, setNombreEmpleado] = useState("");
  const [valorHoraEmpleado, setValorHoraEmpleado] = useState("");
  const [jornadaHoras, setJornadaHoras] = useState("8");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verificar que el usuario esté autenticado
  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/admin/login");
    }
  }, [authLoading, session, navigate]);

  // Verificar si ya tiene empleados (onboarding completado)
  useEffect(() => {
    async function checkEmployees() {
      if (!session?.user?.id || !admin?.empresa_id) {
        setCheckingEmployees(false);
        return;
      }

      try {
        const client = await loadClient();
        const { data: empleados } = await client
          .from("empleados")
          .select("id")
          .eq("empresa_id", admin.empresa_id)
          .limit(1);

        // Si ya tiene empleados, ir directo al dashboard
        if (empleados && empleados.length > 0) {
          navigate("/admin", { replace: true });
          return;
        }
      } catch (err) {
        console.error("Error checking employees:", err);
      } finally {
        setCheckingEmployees(false);
      }
    }

    if (admin?.empresa_id) {
      checkEmployees();
    }
  }, [admin, session, navigate]);

  // Pre-cargar valor hora por defecto del metadata
  useEffect(() => {
    if (session?.user?.user_metadata?.valor_hora_defecto && !valorHoraEmpleado) {
      setValorHoraEmpleado(session.user.user_metadata.valor_hora_defecto.toString());
    }
  }, [session, valorHoraEmpleado]);

  const handleAgregarEmpleado = async () => {
    setError("");
    
    if (!nombreEmpleado.trim()) {
      setError("Completá el nombre del empleado");
      return;
    }
    
    if (!valorHoraEmpleado || parseFloat(valorHoraEmpleado) <= 0) {
      setError("Ingresá un valor hora válido");
      return;
    }
    
    setLoading(true);
    
    try {
      const client = await loadClient();
      
      // Obtener el empresa_id del admin
      const { data: perfil, error: perfilError } = await client
        .from("perfiles_admin")
        .select("empresa_id")
        .eq("id", session?.user?.id)
        .single();
      
      if (perfilError) {
        console.error("Error al obtener perfil:", perfilError);
        setError("Error al obtener datos de tu empresa. Intentá de nuevo.");
        setLoading(false);
        return;
      }
      
      // Crear el empleado
      const { error: empleadoError } = await client
        .from("empleados")
        .insert({
          empresa_id: perfil.empresa_id,
          nombre_completo: nombreEmpleado.trim(),
          valor_hora: parseFloat(valorHoraEmpleado),
          jornada_horas: parseInt(jornadaHoras),
        });
      
      if (empleadoError) {
        console.error("Error al crear empleado:", empleadoError);
        setError("Error al agregar el empleado. Intentá de nuevo.");
        setLoading(false);
        return;
      }
      
      // Éxito - avanzar al step 3
      setStep(3);
    } catch (err) {
      console.error("Error inesperado:", err);
      setError("Error inesperado. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaltar = () => {
    setStep(3);
  };

  const handleIrAlDashboard = () => {
    navigate("/admin", { replace: true });
  };

  // Loading state
  if (authLoading || checkingEmployees) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-4 py-8"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <PanahonLogo size="lg" color="orange" />
      </div>

      {/* Card */}
      <div className="w-full max-w-[540px] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-8">
          {/* Step 1 - Cuenta (completado) */}
          <div className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <p 
                className="text-emerald-600 mt-2"
                style={{ fontSize: "0.75rem", fontWeight: 600 }}
              >
                Cuenta
              </p>
            </div>
          </div>

          {/* Línea 1-2 */}
          <div 
            className={`h-0.5 w-12 sm:w-16 mx-2 ${
              step >= 2 ? "bg-[#F97316]" : "bg-gray-200"
            }`}
          />

          {/* Step 2 - Empleados */}
          <div className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 2 
                    ? "bg-[#F97316] text-white" 
                    : step > 2 
                    ? "bg-emerald-100" 
                    : "bg-gray-100 text-[#1A1A1A]/30"
                }`}
              >
                {step > 2 ? (
                  <Check className="w-5 h-5 text-emerald-600" />
                ) : (
                  <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>2</span>
                )}
              </div>
              <p 
                className={`mt-2 ${
                  step === 2 
                    ? "text-[#F97316]" 
                    : step > 2 
                    ? "text-emerald-600" 
                    : "text-[#1A1A1A]/30"
                }`}
                style={{ fontSize: "0.75rem", fontWeight: 600 }}
              >
                Empleados
              </p>
            </div>
          </div>

          {/* Línea 2-3 */}
          <div 
            className={`h-0.5 w-12 sm:w-16 mx-2 ${
              step >= 3 ? "bg-[#F97316]" : "bg-gray-200"
            }`}
          />

          {/* Step 3 - Tu QR */}
          <div className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 3 
                    ? "bg-[#F97316] text-white" 
                    : "bg-gray-100 text-[#1A1A1A]/30"
                }`}
              >
                <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>3</span>
              </div>
              <p 
                className={step === 3 ? "text-[#F97316]" : "text-[#1A1A1A]/30"}
                style={{ fontSize: "0.75rem", fontWeight: 600 }}
              >
                Listo
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Agregar primer empleado */}
        {step === 2 && (
          <div>
            <h2 
              className="text-[#1A1A1A] text-center mb-2"
              style={{ fontSize: "1.375rem", fontWeight: 700 }}
            >
              Agregá tu primer empleado
            </h2>
            <p 
              className="text-[#1A1A1A]/50 text-center mb-8"
              style={{ fontSize: "0.875rem" }}
            >
              Podés agregar más después desde el dashboard
            </p>

            <div className="space-y-4">
              <div>
                <label 
                  className="block text-[#1A1A1A]/70 mb-1.5"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={nombreEmpleado}
                  onChange={(e) => setNombreEmpleado(e.target.value)}
                  placeholder="Ej: María González"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                  style={{ fontSize: "1rem" }}
                />
              </div>

              <div>
                <label 
                  className="block text-[#1A1A1A]/70 mb-1.5"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  Valor hora *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/50">
                    $
                  </span>
                  <input
                    type="number"
                    value={valorHoraEmpleado}
                    onChange={(e) => setValorHoraEmpleado(e.target.value)}
                    placeholder="2500"
                    className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                    style={{ fontSize: "1rem" }}
                  />
                </div>
              </div>

              <div>
                <label 
                  className="block text-[#1A1A1A]/70 mb-1.5"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  Jornada *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setJornadaHoras("6")}
                    className={`py-3 rounded-lg border-2 transition-all ${
                      jornadaHoras === "6"
                        ? "border-[#F97316] bg-[#F97316]/5 text-[#F97316]"
                        : "border-gray-200 text-[#1A1A1A]/70 hover:border-gray-300"
                    }`}
                    style={{ fontSize: "1rem", fontWeight: 600 }}
                  >
                    6 horas
                  </button>
                  <button
                    type="button"
                    onClick={() => setJornadaHoras("8")}
                    className={`py-3 rounded-lg border-2 transition-all ${
                      jornadaHoras === "8"
                        ? "border-[#F97316] bg-[#F97316]/5 text-[#F97316]"
                        : "border-gray-200 text-[#1A1A1A]/70 hover:border-gray-300"
                    }`}
                    style={{ fontSize: "1rem", fontWeight: 600 }}
                  >
                    8 horas
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-600" style={{ fontSize: "0.875rem" }}>
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleAgregarEmpleado}
                disabled={loading}
                className="w-full py-3.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC620F] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                style={{ fontSize: "1rem", fontWeight: 600 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  "Agregar empleado"
                )}
              </button>

              <button
                onClick={handleSaltar}
                className="w-full text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Saltar por ahora
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Todo listo */}
        {step === 3 && (
          <div className="text-center">
            {/* Ícono de éxito */}
            <div className="w-20 h-20 rounded-full bg-[#F97316]/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-[#F97316]" />
            </div>

            <h2 
              className="text-[#1A1A1A] mb-3"
              style={{ fontSize: "1.75rem", fontWeight: 700 }}
            >
              ¡Todo listo, ya podés empezar!
            </h2>

            <p 
              className="text-[#1A1A1A]/60 mb-6"
              style={{ fontSize: "1rem", lineHeight: 1.6 }}
            >
              Tu equipo ya puede fichar con el QR que recibiste en tu kit de bienvenida.
            </p>

            <div className="bg-[#F8F9FA] rounded-lg p-6 mb-8">
              <p 
                className="text-[#1A1A1A]/70"
                style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
              >
                Si necesitás el QR en formato digital, lo encontrás en cualquier momento en{" "}
                <span className="font-semibold text-[#F97316]">Configuración</span>{" "}
                dentro del dashboard.
              </p>
            </div>

            <button
              onClick={handleIrAlDashboard}
              className="w-full py-3.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC620F] transition-colors"
              style={{ fontSize: "1rem", fontWeight: 600 }}
            >
              Ir al dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}