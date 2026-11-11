import { LayoutDashboard, Users, ClipboardList, BarChart3, ShieldAlert } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { getAlertasCount } from "../../lib/api";
import { FEATURES } from "../../lib/featureFlags";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Empleados", icon: Users, path: "/admin/empleados" },
  { label: "Registros", icon: ClipboardList, path: "/admin/registros" },
  { label: "Reportes", icon: BarChart3, path: "/admin/reportes" },
  { label: "Alertas", icon: ShieldAlert, path: "/admin/alertas", badge: true, feature: "alertas" as const },
];

const navItems = allNavItems.filter((item) => !item.feature || FEATURES[item.feature]);

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 z-40 transition-colors duration-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const count = item.badge ? alertasCount : 0;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 relative ${
                active ? "text-[#F97316]" : "text-[#374151]/50 dark:text-zinc-500"
              }`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                {count > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-white"
                    style={{ fontSize: "0.5625rem", fontWeight: 700, backgroundColor: "#F97316" }}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.625rem", fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
