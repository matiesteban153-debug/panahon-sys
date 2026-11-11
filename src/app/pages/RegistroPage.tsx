import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { PanahonLogo } from "../components/PanahonLogo";

export function RegistroPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  
  // Estado del formulario
  const [paso, setPaso] = useState(1);
  
  // Paso 1: Datos personales
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Paso 2: Datos de la empresa
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [cantidadEmpleados, setCantidadEmpleados] = useState("");
  const [valorHora, setValorHora] = useState("");
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validaciones Paso 1
  const validarPaso1 = () => {
    setError("");
    
    if (!nombreCompleto.trim()) {
      setError("Completá tu nombre completo");
      return false;
    }
    
    if (!email.trim()) {
      setError("Completá tu email");
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Ingresá un email válido");
      return false;
    }
    
    if (!password) {
      setError("Completá tu contraseña");
      return false;
    }
    
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return false;
    }
    
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return false;
    }
    
    return true;
  };
  
  // Validaciones Paso 2
  const validarPaso2 = () => {
    setError("");
    
    if (!nombreEmpresa.trim()) {
      setError("Completá el nombre de tu empresa");
      return false;
    }
    
    if (!rubro) {
      setError("Seleccioná el rubro de tu empresa");
      return false;
    }
    
    if (!cantidadEmpleados) {
      setError("Seleccioná la cantidad de empleados");
      return false;
    }
    
    if (!valorHora || parseFloat(valorHora) <= 0) {
      setError("Ingresá un valor hora válido");
      return false;
    }
    
    return true;
  };

  const handleContinuar = () => {
    if (validarPaso1()) {
      setPaso(2);
    }
  };

  const handleCrearCuenta = async () => {
    if (!validarPaso2()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const result = await signUp(email, password, {
        nombre_completo: nombreCompleto,
        empresa_nombre: nombreEmpresa,
        rubro,
        cantidad_empleados: cantidadEmpleados,
        valor_hora_defecto: parseFloat(valorHora),
      });
      
      if (result.error) {
        // Mapear errores comunes
        if (result.error.includes("already registered") || result.error.includes("already exists")) {
          setError("Este email ya tiene una cuenta. ¿Querés iniciar sesión?");
        } else {
          setError(result.error);
        }
        setLoading(false);
        return;
      }
      
      // Éxito - redirigir a verificación
      navigate("/verificacion-email", { state: { email } });
    } catch (err: any) {
      console.error("Error en registro:", err);
      setError("No pudimos crear tu cuenta. Verificá tu conexión e intentá de nuevo.");
      setLoading(false);
    }
  };

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
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 
            className="text-[#1A1A1A]"
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
          >
            {paso === 1 ? "Creá tu cuenta" : "Configurá tu empresa"}
          </h1>
          <p 
            className="text-[#1A1A1A]/50 mt-1"
            style={{ fontSize: "0.875rem" }}
          >
            {paso === 1 
              ? "Empezá a controlar horas en minutos" 
              : "Casi listo, solo faltan algunos datos"}
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div 
            className={`h-1.5 w-12 rounded-full transition-colors ${
              paso === 1 ? "bg-[#F97316]" : "bg-gray-200"
            }`}
          />
          <div 
            className={`h-1.5 w-12 rounded-full transition-colors ${
              paso === 2 ? "bg-[#F97316]" : "bg-gray-200"
            }`}
          />
        </div>

        {/* Paso 1: Datos personales */}
        {paso === 1 && (
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
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                style={{ fontSize: "1rem" }}
              />
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                style={{ fontSize: "1rem" }}
              />
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                  style={{ fontSize: "1rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Confirmar contraseña *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí tu contraseña"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                  style={{ fontSize: "1rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
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
              onClick={handleContinuar}
              className="w-full py-3.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC620F] transition-colors"
              style={{ fontSize: "1rem", fontWeight: 600 }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Paso 2: Datos de la empresa */}
        {paso === 2 && (
          <div className="space-y-4">
            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Nombre de la empresa *
              </label>
              <input
                type="text"
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
                placeholder="Ej: Restaurante El Rincón"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                style={{ fontSize: "1rem" }}
              />
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Rubro *
              </label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                style={{ fontSize: "1rem" }}
              >
                <option value="">Seleccioná un rubro</option>
                <option value="Gastronomía">Gastronomía</option>
                <option value="Construcción">Construcción</option>
                <option value="Logística">Logística</option>
                <option value="Servicios">Servicios</option>
                <option value="Comercio">Comercio</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Cantidad de empleados *
              </label>
              <select
                value={cantidadEmpleados}
                onChange={(e) => setCantidadEmpleados(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                style={{ fontSize: "1rem" }}
              >
                <option value="">Seleccioná una opción</option>
                <option value="1-5">1-5 empleados</option>
                <option value="6-15">6-15 empleados</option>
                <option value="16-30">16-30 empleados</option>
                <option value="31+">31+ empleados</option>
              </select>
            </div>

            <div>
              <label 
                className="block text-[#1A1A1A]/70 mb-1.5"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                Valor hora por defecto *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/50">
                  $
                </span>
                <input
                  type="number"
                  value={valorHora}
                  onChange={(e) => setValorHora(e.target.value)}
                  placeholder="2500"
                  className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-200 text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-all"
                  style={{ fontSize: "1rem" }}
                />
              </div>
              <p className="text-[#1A1A1A]/40 mt-1.5" style={{ fontSize: "0.75rem" }}>
                Podés cambiarlo para cada empleado después
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-600" style={{ fontSize: "0.875rem" }}>
                  {error}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setPaso(1);
                  setError("");
                }}
                disabled={loading}
                className="px-6 py-3.5 rounded-lg border-2 border-gray-200 text-[#1A1A1A] hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                style={{ fontSize: "1rem", fontWeight: 600 }}
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
              <button
                onClick={handleCrearCuenta}
                disabled={loading}
                className="flex-1 py-3.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC620F] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                style={{ fontSize: "1rem", fontWeight: 600 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Link a login */}
      <p 
        className="mt-6 text-[#1A1A1A]/50"
        style={{ fontSize: "0.875rem" }}
      >
        ¿Ya tenés cuenta?{" "}
        <button
          onClick={() => navigate("/admin/login")}
          className="text-[#F97316] hover:text-[#EA6C0A] font-semibold transition-colors"
        >
          Iniciá sesión
        </button>
      </p>
    </div>
  );
}
