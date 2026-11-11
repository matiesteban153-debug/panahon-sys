import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../lib/theme-context";

type Theme = "light" | "dark" | "system";

const CYCLE: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

const LABELS: Record<Theme, string> = { light: "Claro", dark: "Oscuro", system: "Sistema" };

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];

  return (
    <button
      onClick={() => setTheme(CYCLE[theme])}
      title={`Tema actual: ${LABELS[theme]}`}
      className={`flex items-center gap-2 rounded-lg text-[#374151]/60 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-[#374151] dark:hover:text-zinc-100 transition-colors ${
        compact ? "p-2" : "px-3 py-2 w-full"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
      {!compact && (
        <span style={{ fontSize: "0.8125rem" }}>{LABELS[theme]}</span>
      )}
    </button>
  );
}
