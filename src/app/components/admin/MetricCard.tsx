import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down";
}

export function MetricCard({ label, value, change, changeType }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-800 transition-colors duration-200" style={{ minHeight: 120 }}>
      <p className="text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
        {label}
      </p>
      <p className="text-[#1A1A1A] dark:text-zinc-50 mt-2" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        {value}
      </p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {changeType === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : changeType === "down" ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          ) : null}
          <span
            className={changeType === "up" ? "text-emerald-600" : changeType === "down" ? "text-red-500" : "text-[#1A1A1A]/40 dark:text-zinc-500"}
            style={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            {change}
          </span>
        </div>
      )}
    </div>
  );
}
