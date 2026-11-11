import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router";
import { PanahonLogo } from "./PanahonLogo";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur shadow-sm" : "bg-white"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
          <PanahonLogo size="md" color="orange" />
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo("como-funciona")} className="text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors" style={{ fontSize: "0.875rem" }}>
            Cómo funciona
          </button>
          <button onClick={() => scrollTo("beneficios")} className="text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors" style={{ fontSize: "0.875rem" }}>
            Beneficios
          </button>
          <button onClick={() => scrollTo("precios")} className="text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors" style={{ fontSize: "0.875rem" }}>
            Precios
          </button>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate("/admin/login")} className="px-5 py-2.5 rounded-md border border-[#1A1A1A]/20 text-[#1A1A1A] hover:border-[#1A1A1A]/40 transition-colors" style={{ fontSize: "0.875rem" }}>
            Iniciar sesión
          </button>
          <button onClick={() => navigate("/registro")} className="px-5 py-2.5 rounded-md bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors" style={{ fontSize: "0.875rem" }}>
            Quiero empezar
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-[#1A1A1A]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4">
          <div className="flex flex-col gap-3 pt-3">
            <button onClick={() => scrollTo("como-funciona")} className="text-left text-[#1A1A1A]/70 py-2" style={{ fontSize: "0.9375rem" }}>
              Cómo funciona
            </button>
            <button onClick={() => scrollTo("beneficios")} className="text-left text-[#1A1A1A]/70 py-2" style={{ fontSize: "0.9375rem" }}>
              Beneficios
            </button>
            <button onClick={() => scrollTo("precios")} className="text-left text-[#1A1A1A]/70 py-2" style={{ fontSize: "0.9375rem" }}>
              Precios
            </button>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => navigate("/admin/login")} className="px-5 py-2.5 rounded-md border border-[#1A1A1A]/20 text-[#1A1A1A]" style={{ fontSize: "0.9375rem" }}>
                Iniciar sesión
              </button>
              <button onClick={() => navigate("/registro")} className="px-5 py-2.5 rounded-md bg-[#F97316] text-white" style={{ fontSize: "0.9375rem" }}>
                Quiero empezar
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}