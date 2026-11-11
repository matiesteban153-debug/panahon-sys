import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { PanahonLogo } from "../PanahonLogo";
import { getFriendlyError } from "../../lib/errorUtils";

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: auth.signUp() creates the user in Supabase Auth (gets userId).
      // Step 2: server POST /signup receives { userId, email, name, companyName }
      //         and creates empresa + perfiles_admin using service_role.
      // Both steps happen inside signUp() from auth-context.
      const result = await signUp(email, password, {
        nombre_completo: name,
        empresa_nombre: companyName || `Empresa de ${name}`,
        rubro: "gastronomico",
        cantidad_empleados: "1",
        valor_hora_defecto: 3000,
      });

      if (result.error) {
        console.error("[SignupPage] Error en registro:", result.error);
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/admin", { replace: true }), 1500);
    } catch (err: any) {
      console.error("[SignupPage] Error inesperado al registrar:", err);
      setError(getFriendlyError(err, "No pudimos completar el registro. Revisá tu conexión e intentá nuevamente."));
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center px-4"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-[#1A1A1A]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            Cuenta creada
          </h2>
          <p className="text-[#1A1A1A]/50 mt-2" style={{ fontSize: "0.875rem" }}>
            Ingresando a tu panel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <PanahonLogo size="lg" color="orange" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h1 className="text-[#1A1A1A] text-center" style={{ fontSize: "1.375rem", fontWeight: 700 }}>
          Crea tu cuenta gratis
        </h1>
        <p className="text-[#1A1A1A]/45 text-center mt-1" style={{ fontSize: "0.875rem" }}>
          Empieza a controlar horas en minutos
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Tu nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/25 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>
          <div>
            <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Nombre de tu empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej: Restaurante El Rincón"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/25 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>
          <div>
            <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/25 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>
          <div>
            <label className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Contraseña *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/25 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white"
                style={{ fontSize: "0.9375rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A]/60"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500" style={{ fontSize: "0.8125rem" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            style={{ fontSize: "1rem", fontWeight: 600, minHeight: 48 }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta gratis"
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-[#1A1A1A]/40" style={{ fontSize: "0.8125rem" }}>
        ¿Ya tenés cuenta?{" "}
        <button
          onClick={() => navigate("/admin/login")}
          className="text-[#F97316] hover:text-[#EA6C0A] font-medium"
        >
          Iniciá sesión
        </button>
      </p>
    </div>
  );
}