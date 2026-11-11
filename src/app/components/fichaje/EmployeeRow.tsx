import { ChevronRight } from "lucide-react";
import { EmployeeAvatar } from "./Avatar";
import type { Employee } from "./types";

interface EmployeeRowProps {
  employee: Employee;
  onSelect: (employee: Employee) => void;
}

export function EmployeeRow({ employee, onSelect }: EmployeeRowProps) {
  return (
    <button
      onClick={() => onSelect(employee)}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[64px]"
    >
      <EmployeeAvatar
        name={employee.name}
        size="sm"
        hasClockedIn={employee.entryTime !== null}
      />
      <div className="flex-1 text-left">
        <p
          className="text-[#1A1A1A]"
          style={{ fontSize: "1rem", fontWeight: 500 }}
        >
          {employee.name}
        </p>
        {employee.entryTime && (
          <p
            className={employee.estado === "jornada_completa" ? "text-[#1A1A1A]/40" : "text-[#22C55E]"}
            style={{ fontSize: "0.8125rem" }}
          >
            {employee.estado === "jornada_completa"
              ? "Jornada completa"
              : `Entrada a las ${employee.entryTime}`}
          </p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-[#1A1A1A]/25 flex-shrink-0" />
    </button>
  );
}