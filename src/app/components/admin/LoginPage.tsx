import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { PanahonLogo } from "../PanahonLogo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../lib/demo";
import { getFriendlyError } from "../../lib/errorUtils";

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    console.log("[Auth] LoginPage useEffect: authLoading=", authLoading, "session=", !!session);
    if (!authLoading && session) {
      console.log("[Auth] LoginPage: session detected, redirecting to /admin");
      navigate("/admin", { replace: true });
    }
  }, [authLoading, session, navigate]);

  // Auto-login when ?mode=demo is present in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "demo") return;
    if (authLoading || session) return; // wait for auth to settle; skip if already logged in

    setDemoLoading(true);
    signIn(DEMO_EMAIL, DEMO_PASSWORD)
      .then(({ error: signInError }) => {
        if (signInError) {
          console.error("[Demo] Auto-login failed:", signInError);
          setDemoLoading(false);
          setError("No se pudo iniciar el modo demo. Intentá de nuevo.");
        }
        // On success the `session` watcher above will redirect to /admin
      })
      .catch((err: any) => {
        console.error("[Demo] Unexpected error:", err);
        setDemoLoading(false);
        setError(getFriendlyError(err, "No pudimos iniciar el modo demo. Intentá nuevamente."));
      });
  // Only run once after auth has settled
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Completa email y contraseña.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(getFriendlyError(result.error, "No pudimos iniciar sesión. Revisá tus datos e intentá nuevamente."));
        setLoading(false);
      }
      // On success, the useEffect watching `session` will redirect to /admin
    } catch (err: any) {
      console.error("Login error:", err);
      setError(getFriendlyError(err, "No pudimos iniciar sesión. Revisá tu conexión e intentá nuevamente."));
      setLoading(false);
    }
  };

  // Full-screen demo loading overlay — shown while auto-login is in progress
  if (demoLoading) {
    return (
      <div
        className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center gap-4"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <PanahonLogo size="lg" color="orange" />
        <div className="flex items-center gap-2.5 mt-4 text-[#1A1A1A]/50">
          <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
          <span style={{ fontSize: "0.9375rem" }}>Iniciando modo demo…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F4F5F7] dark:bg-zinc-950 flex flex-col items-center justify-center px-4 transition-colors duration-200"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <PanahonLogo size="lg" color="orange" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 sm:p-8">
        <h1
          className="text-[#1A1A1A] dark:text-zinc-50 text-center"
          style={{ fontSize: "1.375rem", fontWeight: 700 }}
        >
          Ingresa a tu cuenta
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Email */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-colors bg-white dark:bg-zinc-800"
              style={{ fontSize: "0.9375rem" }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition-colors bg-white dark:bg-zinc-800"
                style={{ fontSize: "0.9375rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A]/60 dark:text-zinc-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4.5 h-4.5" />
                ) : (
                  <Eye className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500" style={{ fontSize: "0.8125rem" }}>
              {error}
            </p>
          )}

          {/* Remember + forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]/30 accent-[#F97316]"
              />
              <span
                className="text-[#1A1A1A]/60 dark:text-zinc-400"
                style={{ fontSize: "0.8125rem" }}
              >
                Recordarme
              </span>
            </label>
            <button
              type="button"
              className="text-[#F97316] hover:text-[#EA6C0A]"
              style={{ fontSize: "0.8125rem", fontWeight: 500 }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            style={{ fontSize: "1rem", fontWeight: 600, minHeight: 48 }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                Ingresando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <footer className="mt-6 flex flex-col items-center gap-3">
        <p className="text-[#1A1A1A]/40 dark:text-zinc-600" style={{ fontSize: "0.8125rem" }}>
          ¿No tenés cuenta?{" "}
          <button onClick={() => navigate("/registro")} className="font-medium text-[#F97316] hover:text-[#EA6C0A]">
            Crea una gratis
          </button>
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <a href="/privacidad" className="transition-colors hover:text-orange-600">Política de Privacidad</a>
          <a href="/privacidad?tab=terminos" className="transition-colors hover:text-orange-600">Términos y Condiciones</a>
        </div>
      </footer>
    </div>
  );
}
