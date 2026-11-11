import { useState } from "react";
import { Search } from "lucide-react";
import { EmployeeRow } from "./EmployeeRow";
import type { Employee } from "./types";
import { PanahonLogo } from "../PanahonLogo";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { ClockHelp } from "./ClockHelp";

interface SelectionScreenProps {
  companyName: string;
  employees: Employee[];
  onSelect: (employee: Employee) => void;
}

export function SelectionScreen({
  companyName,
  employees,
  onSelect,
}: SelectionScreenProps) {
  const [search, setSearch] = useState("");

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const showSearch = employees.length > 8;

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="mb-3 flex justify-end"><ClockHelp /></div>
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <PanahonLogo size="sm" color="orange" />
        </div>

        {/* Company name */}
        <p
          className="text-center text-[#1A1A1A]/45"
          style={{ fontSize: "0.875rem", fontWeight: 500 }}
        >
          {companyName}
        </p>

        {/* Title */}
        <h1
          className="text-center text-[#1A1A1A] mt-4"
          style={{ fontSize: "1.75rem", fontWeight: 700 }}
        >
          ¿Quién sos?
        </h1>

        {/* PWA Install Banner */}
        <div className="mt-5">
          <PWAInstallBanner />
        </div>

        {/* Search */}
        {showSearch && (
          <div className="relative mt-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A1A1A]/30" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#F8F9FA] border-none text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
              style={{ fontSize: "1rem" }}
            />
          </div>
        )}
      </div>

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="divide-y divide-gray-100">
          {filtered.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              onSelect={onSelect}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p
              className="text-[#1A1A1A]/35"
              style={{ fontSize: "0.9375rem" }}
            >
              No se encontraron empleados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
