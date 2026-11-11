import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "../../lib/auth-context";
import { PanahonLogo } from "../PanahonLogo";
import { useState, useEffect } from "react";
import { getAlertasCount } from "../../lib/api";
import { ThemeToggle } from "../ThemeToggle";
import { FEATURES } from "../../lib/featureFlags";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Empleados", icon: Users, path: "/admin/empleados" },
  { label: "Registros", icon: ClipboardList, path: "/admin/registros" },
  { label: "Reportes", icon: BarChart3, path: "/admin/reportes" },
  { label: "Alertas", icon: ShieldAlert, path: "/admin/alertas", badge: true, feature: "alertas" as const },
  { label: "Configuración", icon: Settings, path: "/admin/configuracion" },
];

const navItems = allNavItems.filter((item) => !item.feature || FEATURES[item.feature]);

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, signOut } = useAuth();
  const [alertasCount, setAlertasCount] = useState(0);

  useEffect(() => {
    getAlertasCount()
      .then(setAlertasCount)
      .catch(() => setAlertasCount(0));
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <aside className="hidden lg:flex w-[240px] flex-col bg-white dark:bg-zinc-900 border-r border-[#E5E7EB] dark:border-zinc-800 h-screen fixed left-0 top-0 z-40 transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center px-5 h-16 border-b border-gray-100 dark:border-zinc-800">
        <PanahonLogo size="sm" color="orange" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const count = item.badge ? alertasCount : 0;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-[#FFF4EC] dark:bg-orange-950/60 text-[#F97316]"
                  : "text-[#374151] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              <item.icon
                className="w-5 h-5 flex-shrink-0"
                strokeWidth={1.5}
              />
              <span
                className="flex-1 text-left"
                style={{ fontSize: "0.875rem", fontWeight: active ? 600 : 400 }}
              >
                {item.label}
              </span>
              {count > 0 && (
                <span
                  className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-white"
                  style={{ fontSize: "0.6875rem", fontWeight: 700, backgroundColor: "#F97316" }}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme toggle + user + sign out */}
      <div className="px-3 pb-4 border-t border-gray-100 dark:border-zinc-800 pt-3 space-y-1">
        <ThemeToggle />
        <div className="px-3 py-2">
          <p
            className="text-[#1A1A1A] dark:text-zinc-100"
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            {admin?.nombre_completo || "Admin"}
          </p>
          <p
            className="text-[#1A1A1A]/40 dark:text-zinc-500"
            style={{ fontSize: "0.75rem" }}
          >
            {admin?.email || ""}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#1A1A1A]/50 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          <span style={{ fontSize: "0.8125rem" }}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
