import { Linkedin, Instagram } from "lucide-react";
import { PanahonLogo } from "./PanahonLogo";

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

const footerLinks = {
  Producto: [
    { label: "Cómo funciona", action: () => scrollTo("como-funciona") },
    { label: "Precios", action: () => scrollTo("precios") },
    { label: "Demo", action: () => (window.location.href = "/fichaje") },
  ],
  Empresa: [
    { label: "Sobre nosotros", action: () => {} },
    { label: "Blog", action: () => {} },
    { label: "Contacto", action: () => {} },
  ],
  Legal: [
    { label: "Términos", action: () => {} },
    { label: "Privacidad", action: () => {} },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#F8F9FA] border-t border-[#1A1A1A]/5">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
          {/* Logo column */}
          <div className="col-span-2 md:col-span-2">
            <div className="mb-3">
              <PanahonLogo size="sm" color="orange" />
            </div>
            <p
              className="text-[#1A1A1A]/45 max-w-[240px]"
              style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}
            >
              Control horario simple con QR para PyMEs.
            </p>
            {/* Social */}
            <div className="flex gap-3 mt-5">
              <a
                href="#"
                className="w-8 h-8 rounded-md bg-[#1A1A1A]/5 flex items-center justify-center hover:bg-[#1A1A1A]/10 transition-colors"
              >
                <Linkedin
                  className="w-4 h-4 text-[#1A1A1A]/50"
                  strokeWidth={1.5}
                />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-md bg-[#1A1A1A]/5 flex items-center justify-center hover:bg-[#1A1A1A]/10 transition-colors"
              >
                <Instagram
                  className="w-4 h-4 text-[#1A1A1A]/50"
                  strokeWidth={1.5}
                />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4
                className="text-[#1A1A1A]/40 uppercase tracking-wider mb-4"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={link.action}
                      className="text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors text-left"
                      style={{ fontSize: "0.875rem" }}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-6 border-t border-[#1A1A1A]/5">
          <p
            className="text-[#1A1A1A]/35"
            style={{ fontSize: "0.8125rem" }}
          >
            &copy; 2026 Panahon. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}