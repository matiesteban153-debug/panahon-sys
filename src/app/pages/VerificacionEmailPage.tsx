import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Mail, Loader2 } from "lucide-react";
import { PanahonLogo } from "../components/PanahonLogo";
import { loadClient } from "../lib/supabase";

export function VerificacionEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";
  
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Si no hay email, redirigir al registro
  useEffect(() => {
    if (!email) {
      navigate("/registro");
    }
  }, [email, navigate]);

  const handleReenviar = async () => {
    if (cooldown > 0 || sending) return;
    
    setSending(true);
    setMessage("");
    
    try {
      const client = await loadClient();
      const { error } = await client.auth.resend({
        type: "signup",
        email: email,
      });
      
      if (error) {
        setMessage("Error al reenviar el email. Intentá de nuevo.");
      } else {
        setMessage("¡Email reenviado! Revisá tu casilla.");
        setCooldown(60);
      }
    } catch (err) {
      console.error("Error al reenviar email:", err);
      setMessage("Error al reenviar el email. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <PanahonLogo size="lg" color="orange" />
      </div>

      {/* Card */}
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {/* Ícono */}
        <div className="w-16 h-16 rounded-full bg-[#F97316]/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[#F97316]" />
        </div>

        {/* Título */}
        <h1 
          className="text-[#1A1A1A] mb-3"
          style={{ fontSize: "1.5rem", fontWeight: 700 }}
        >
          Revisá tu casilla de correo
        </h1>

        {/* Descripción */}
        <p 
          className="text-[#1A1A1A]/60 mb-2"
          style={{ fontSize: "1rem" }}
        >
          Te enviamos un link de verificación a
        </p>
        <p 
          className="text-[#F97316] mb-8"
          style={{ fontSize: "1rem", fontWeight: 600 }}
        >
          {email}
        </p>

        <p 
          className="text-[#1A1A1A]/50 mb-8"
          style={{ fontSize: "0.875rem" }}
        >
          Hacé click en el link para activar tu cuenta y acceder al onboarding.
        </p>

        {/* Mensaje de feedback */}
        {message && (
          <div 
            className={`mb-6 px-4 py-3 rounded-lg ${
              message.includes("Error") 
                ? "bg-red-50 text-red-600 border border-red-200" 
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            <p style={{ fontSize: "0.875rem" }}>{message}</p>
          </div>
        )}

        {/* Botón reenviar */}
        <button
          onClick={handleReenviar}
          disabled={cooldown > 0 || sending}
          className="w-full py-3 rounded-lg border-2 border-[#F97316] text-[#F97316] hover:bg-[#F97316]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-4"
          style={{ fontSize: "1rem", fontWeight: 600 }}
        >
          {sending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Reenviando...
            </>
          ) : cooldown > 0 ? (
            `Reenviar email (${cooldown}s)`
          ) : (
            "Reenviar email"
          )}
        </button>

        {/* Link cambiar email */}
        <button
          onClick={() => navigate("/registro")}
          className="text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors"
          style={{ fontSize: "0.875rem" }}
        >
          Cambiar email
        </button>
      </div>

      {/* Ayuda */}
      <p 
        className="mt-8 text-[#1A1A1A]/40 text-center max-w-md"
        style={{ fontSize: "0.8125rem" }}
      >
        ¿No recibiste el email? Revisá la carpeta de spam o correo no deseado.
      </p>
    </div>
  );
}
