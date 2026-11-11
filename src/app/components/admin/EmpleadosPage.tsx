import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Users, Loader2, Smartphone, SmartphoneNfc } from "lucide-react";
import { Badge } from "./Badge";
import { Modal } from "./Modal";
import { useAuth } from "../../lib/auth-context";
import { getEmployees, saveEmployee, deleteEmployee, resetEmpleadoDevice } from "../../lib/api";
import { trackEvent } from "../../lib/telemetry";
import { getFriendlyError } from "../../lib/errorUtils";

interface Employee {
  id: string;
  nombre_completo: string;
  email: string;
  initials: string;
  tipo_jornada: "por_hora" | "mensual" | "jornada";
  valor_hora: number;
  sueldo_base_mensual: number | null;
  valor_jornada: number | null;
  jornada_horas: number;
  activo: boolean;
  device_id: string | null;
}

const avatarColors = [
  "bg-orange-100 text-orange-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700",
];

const emptyForm = {
  nombre_completo: "",
  email: "",
  tipo_jornada: "por_hora" as "por_hora" | "mensual" | "jornada",
  valor_hora: "",
  sueldo_base_mensual: "",
  valor_jornada: "",
  jornada_horas: "8",
  activo: true,
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Device status pill ───────────────────────────────────────────────────────
function DevicePill({ bound }: { bound: boolean }) {
  if (bound) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"
        style={{ fontSize: "0.71rem", fontWeight: 600 }}>
        <SmartphoneNfc className="w-3 h-3" />
        Vinculado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-[#1A1A1A]/35 border border-gray-100"
      style={{ fontSize: "0.71rem", fontWeight: 500 }}>
      <Smartphone className="w-3 h-3" />
      Sin vincular
    </span>
  );
}

export function EmpleadosPage() {
  const { admin, session } = useAuth();
  const empresaId   = admin?.empresa_id || "";
  const accessToken = session?.access_token || "";

  const [employees,         setEmployees]         = useState<Employee[]>([]);
  const [search,            setSearch]            = useState("");
  const [showForm,          setShowForm]          = useState(false);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [deleteTarget,      setDeleteTarget]      = useState<Employee | null>(null);
  const [resetDeviceTarget, setResetDeviceTarget] = useState<Employee | null>(null);
  const [form,              setForm]              = useState(emptyForm);
  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [resetting,         setResetting]         = useState(false);
  const [operationError,    setOperationError]    = useState("");

  const fetchEmps = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const data = await getEmployees(empresaId);
      const mapped: Employee[] = data.map((e: any) => ({
        id: e.id,
        nombre_completo: e.nombre_completo || "",
        email: e.email || "",
        initials: getInitials(e.nombre_completo || "??"),
        tipo_jornada: e.tipo_jornada || "por_hora",
        valor_hora: e.valor_hora || 0,
        sueldo_base_mensual: e.sueldo_base_mensual ?? null,
        valor_jornada: e.valor_jornada ?? null,
        jornada_horas: e.jornada_horas || 8,
        activo: e.activo !== false,
        device_id: e.device_id ?? null,
      }));
      setEmployees(mapped);
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchEmps(); }, [fetchEmps]);

  const filtered = employees.filter((e) =>
    e.nombre_completo.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setOperationError(""); setEditingId(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (emp: Employee) => {
    setOperationError("");
    setEditingId(emp.id);
    setForm({
      nombre_completo: emp.nombre_completo,
      email: emp.email,
      tipo_jornada: emp.tipo_jornada,
      valor_hora: String(emp.valor_hora),
      sueldo_base_mensual: emp.sueldo_base_mensual != null ? String(emp.sueldo_base_mensual) : "",
      valor_jornada: emp.valor_jornada != null ? String(emp.valor_jornada) : "",
      jornada_horas: String(emp.jornada_horas),
      activo: emp.activo,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const esMensual = form.tipo_jornada === "mensual";
    const esJornada = form.tipo_jornada === "jornada";
    if (!form.nombre_completo || !empresaId) return;
    if (!esMensual && !esJornada && !form.valor_hora) return;
    if (esMensual && !form.sueldo_base_mensual) return;
    if (esJornada && !form.valor_jornada) return;
    setOperationError("");
    setSaving(true);
    const isCreate = !editingId;
    try {
      await saveEmployee(empresaId, {
        id: editingId || undefined,
        nombre_completo: form.nombre_completo,
        email: form.email,
        tipo_jornada: form.tipo_jornada,
        valor_hora: esMensual || esJornada ? 0 : Number(form.valor_hora),
        sueldo_base_mensual: esMensual ? Number(form.sueldo_base_mensual) : null,
        valor_jornada: esJornada ? Number(form.valor_jornada) : null,
        jornada_horas: Number(form.jornada_horas),
        activo: form.activo,
      });
      trackEvent({
        evento: isCreate ? "empleado_creado" : "empleado_editado",
        empresa_id: empresaId,
        empleado_id: editingId ?? undefined,
        resultado: "ok",
        metadata: {
          nombre: form.nombre_completo,
          tipo_jornada: form.tipo_jornada,
          valor_hora: esMensual || esJornada ? 0 : Number(form.valor_hora),
          sueldo_base_mensual: esMensual ? Number(form.sueldo_base_mensual) : null,
          valor_jornada: esJornada ? Number(form.valor_jornada) : null,
          jornada_horas: Number(form.jornada_horas),
          activo: form.activo,
        },
      });
      await fetchEmps();
      setShowForm(false);
    } catch (err: any) {
      console.error("Error saving employee:", err);
      trackEvent({
        evento: isCreate ? "empleado_creado" : "empleado_editado",
        empresa_id: empresaId,
        resultado: "error",
        error_mensaje: err?.message,
        metadata: { nombre: form.nombre_completo },
      });
      setOperationError(getFriendlyError(err, "No pudimos guardar el empleado. Revisá los datos e intentá nuevamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setOperationError("");
    setSaving(true);
    try {
      await deleteEmployee(deleteTarget.id);
      trackEvent({
        evento: "empleado_eliminado",
        empresa_id: empresaId,
        empleado_id: deleteTarget.id,
        resultado: "ok",
        metadata: { nombre: deleteTarget.nombre_completo },
      });
      await fetchEmps();
      setDeleteTarget(null);
    } catch (err: any) {
      console.error("Error deleting employee:", err);
      trackEvent({
        evento: "empleado_eliminado",
        empresa_id: empresaId,
        empleado_id: deleteTarget.id,
        resultado: "error",
        error_mensaje: err?.message,
      });
      setOperationError(getFriendlyError(err, "No pudimos eliminar el empleado. Intentá nuevamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDevice = async () => {
    if (!resetDeviceTarget || !accessToken) return;
    setOperationError("");
    setResetting(true);
    try {
      await resetEmpleadoDevice(resetDeviceTarget.id, accessToken);
      await fetchEmps();
      setResetDeviceTarget(null);
    } catch (err) {
      console.error("Error resetting device:", err);
      setOperationError(getFriendlyError(err, "No pudimos resetear el dispositivo. Intentá nuevamente."));
    } finally {
      setResetting(false);
    }
  };

  const formatJornada = (h: number) => `${h} hs/día`;

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1160px]">
        <h1 className="text-[#1A1A1A] dark:text-zinc-50 mb-6" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Empleados</h1>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          <span className="ml-3 text-[#1A1A1A]/50 dark:text-zinc-500" style={{ fontSize: "0.875rem" }}>Cargando empleados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1160px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-[#1A1A1A] dark:text-zinc-50" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Empleados</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
          <Plus className="w-4 h-4" />
          Agregar empleado
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1A1A1A]/30" />
        <input type="text" placeholder="Buscar empleado..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/30 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-900"
          style={{ fontSize: "0.875rem" }} />
      </div>

      {/* Empty state */}
      {employees.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF4EC] dark:bg-orange-950/60 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-[#F97316]" strokeWidth={1.5} />
          </div>
          <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>Todavía no cargaste empleados</p>
          <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-1 mb-5" style={{ fontSize: "0.875rem" }}>Agrega al primero para empezar a usar el control horario.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            <Plus className="w-4 h-4" /> Agregar el primero
          </button>
        </div>
      )}

      {/* Table - Desktop */}
      {filtered.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-zinc-800/70">
                  <th className="text-left px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>NOMBRE</th>
                  <th className="text-center px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>TIPO</th>
                  <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>COMPENSACIÓN</th>
                  <th className="text-center px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>JORNADA</th>
                  <th className="text-center px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>ESTADO</th>
                  <th className="text-center px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>DISPOSITIVO</th>
                  <th className="text-right px-5 py-3 text-[#1A1A1A]/45 dark:text-zinc-400" style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr key={emp.id} className={`border-t border-gray-50 dark:border-zinc-800 ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-zinc-800/30" : ""} hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors`} style={{ height: 56 }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{emp.initials}</span>
                        </div>
                        <div>
                          <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.875rem", fontWeight: 500 }}>{emp.nombre_completo}</p>
                          <p className="text-[#1A1A1A]/40 dark:text-zinc-500" style={{ fontSize: "0.75rem" }}>{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-5 py-3">
                      {emp.tipo_jornada === "mensual" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Mensual</span>
                      ) : emp.tipo_jornada === "jornada" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Por Jornada</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Por Hora</span>
                      )}
                    </td>
                    <td className="text-right px-5 py-3 text-[#1A1A1A]/70 dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>
                      {emp.tipo_jornada === "mensual"
                        ? `$${(emp.sueldo_base_mensual || 0).toLocaleString("es-AR")}/mes`
                        : emp.tipo_jornada === "jornada"
                        ? `$${(emp.valor_jornada || 0).toLocaleString("es-AR")}/día`
                        : `$${emp.valor_hora.toLocaleString("es-AR")}/h`}
                    </td>
                    <td className="text-center px-5 py-3 text-[#1A1A1A]/70 dark:text-zinc-400" style={{ fontSize: "0.875rem" }}>{formatJornada(emp.jornada_horas)}</td>
                    <td className="text-center px-5 py-3">
                      <Badge variant={emp.activo ? "active" : "inactive"}>{emp.activo ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="text-center px-5 py-3">
                      <DevicePill bound={!!emp.device_id} />
                    </td>
                    <td className="text-right px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(emp)} className="p-2 text-[#1A1A1A]/30 hover:text-[#F97316] rounded-lg hover:bg-[#FFF4EC] dark:text-zinc-600 dark:hover:bg-orange-950/40 transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
                        {/* Reset device — only active if device is bound */}
                        <button
                          onClick={() => emp.device_id ? setResetDeviceTarget(emp) : undefined}
                          disabled={!emp.device_id}
                          title={emp.device_id ? "Resetear dispositivo" : "Sin dispositivo vinculado"}
                          className={`p-2 rounded-lg transition-colors ${emp.device_id ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer" : "text-[#1A1A1A]/15 cursor-default"}`}
                        >
                          <SmartphoneNfc className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} className="p-2 text-[#1A1A1A]/30 hover:text-red-500 rounded-lg hover:bg-red-50 dark:text-zinc-600 dark:hover:bg-red-950/30 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards - Mobile */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map((emp, i) => (
            <div key={emp.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${avatarColors[i % avatarColors.length]}`}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{emp.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{emp.nombre_completo}</p>
                  <p className="text-[#1A1A1A]/40 dark:text-zinc-500" style={{ fontSize: "0.75rem" }}>{emp.email}</p>
                </div>
                <Badge variant={emp.activo ? "active" : "inactive"}>{emp.activo ? "Activo" : "Inactivo"}</Badge>
              </div>

              {/* Device status row */}
              <div className="flex items-center justify-between py-2 border-t border-gray-50 dark:border-zinc-800">
                <DevicePill bound={!!emp.device_id} />
                {emp.device_id && (
                  <button
                    onClick={() => setResetDeviceTarget(emp)}
                    className="text-amber-500 hover:text-amber-600 flex items-center gap-1 transition-colors"
                    style={{ fontSize: "0.75rem", fontWeight: 500 }}
                  >
                    <SmartphoneNfc className="w-3.5 h-3.5" />
                    Resetear
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  {emp.tipo_jornada === "mensual" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Mensual</span>
                  ) : emp.tipo_jornada === "jornada" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Por Jornada</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100" style={{ fontSize: "0.71rem", fontWeight: 600 }}>Por Hora</span>
                  )}
                  <span className="text-[#1A1A1A]/60 dark:text-zinc-400" style={{ fontSize: "0.8125rem" }}>
                    {emp.tipo_jornada === "mensual"
                      ? `$${(emp.sueldo_base_mensual || 0).toLocaleString("es-AR")}/mes`
                      : emp.tipo_jornada === "jornada"
                      ? `$${(emp.valor_jornada || 0).toLocaleString("es-AR")}/día`
                      : `$${emp.valor_hora.toLocaleString("es-AR")}/h`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(emp)} className="p-2 text-[#1A1A1A]/30 hover:text-[#F97316] dark:text-zinc-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteTarget(emp)} className="p-2 text-[#1A1A1A]/30 hover:text-red-500 dark:text-zinc-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Editar empleado" : "Agregar empleado"}>
        <div className="space-y-4">
          {operationError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" style={{ fontSize: "0.8125rem" }}>{operationError}</p>}
          {/* Nombre */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Nombre completo *</label>
            <input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Ej: María González"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }} />
          </div>
          {/* Email */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Email (opcional)</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ej: maria@empresa.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }} />
          </div>
          {/* Tipo de Jornada */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Tipo de Jornada *</label>
            <select
              value={form.tipo_jornada}
              onChange={(e) => setForm({ ...form, tipo_jornada: e.target.value as "por_hora" | "mensual" | "jornada" })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }}>
              <option value="por_hora">Por Hora</option>
              <option value="jornada">Por Jornada (día trabajado)</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          {/* Valor Hora — solo para por_hora */}
          {form.tipo_jornada === "por_hora" && (
            <div>
              <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Valor Hora *</label>
              <input type="number" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value })} placeholder="Ej: 3500"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }} />
            </div>
          )}
          {/* Valor por Jornada — solo para jornada */}
          {form.tipo_jornada === "jornada" && (
            <div>
              <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Valor por Día *</label>
              <input type="number" value={form.valor_jornada} onChange={(e) => setForm({ ...form, valor_jornada: e.target.value })} placeholder="Ej: 12000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }} />
              <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-1.5" style={{ fontSize: "0.75rem" }}>Se cobra este monto por cada día trabajado (presencia completa con fichaje de salida).</p>
            </div>
          )}
          {/* Sueldo Base Mensual — solo para mensual */}
          {form.tipo_jornada === "mensual" && (
            <div>
              <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Sueldo Base Mensual *</label>
              <input type="number" value={form.sueldo_base_mensual} onChange={(e) => setForm({ ...form, sueldo_base_mensual: e.target.value })} placeholder="Ej: 350000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 placeholder:text-[#1A1A1A]/25 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }} />
              <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-1.5" style={{ fontSize: "0.75rem" }}>Sueldo fijo mensual. No se calcula por horas trabajadas.</p>
            </div>
          )}
          {/* Jornada laboral */}
          <div>
            <label className="block text-[#1A1A1A]/60 dark:text-zinc-400 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Jornada laboral</label>
            <select value={form.jornada_horas} onChange={(e) => setForm({ ...form, jornada_horas: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] bg-white dark:bg-zinc-800" style={{ fontSize: "0.9375rem" }}>
              <option value="4">4 horas/día</option>
              <option value="6">6 horas/día</option>
              <option value="8">8 horas/día</option>
              <option value="10">10 horas/día</option>
            </select>
            <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-1.5" style={{ fontSize: "0.75rem" }}>Se usará para detectar registros con horas inusuales.</p>
          </div>
          {/* Estado */}
          <div className="flex items-center justify-between py-1">
            <label className="text-[#1A1A1A]/60 dark:text-zinc-400" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Estado</label>
            <button type="button" onClick={() => setForm({ ...form, activo: !form.activo })}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.activo ? "bg-[#F97316]" : "bg-gray-300"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform ${form.activo ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
          <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-[#1A1A1A]/70 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors disabled:opacity-50" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {saving ? "Guardando..." : "Guardar empleado"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar empleado">
        {operationError && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" style={{ fontSize: "0.8125rem" }}>{operationError}</p>}
        <div className="text-center py-2">
          <p className="text-[#1A1A1A] dark:text-zinc-100" style={{ fontSize: "1rem" }}>
            ¿Estás seguro que querés eliminar a <strong>{deleteTarget?.nombre_completo}</strong>?
          </p>
          <p className="text-[#1A1A1A]/45 dark:text-zinc-500 mt-2" style={{ fontSize: "0.875rem" }}>Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/70 hover:bg-gray-50 transition-colors" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Cancelar</button>
          <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {saving ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </Modal>

      {/* Reset Device Confirmation Modal */}
      <Modal open={!!resetDeviceTarget} onClose={() => setResetDeviceTarget(null)} title="Resetear dispositivo">
        {operationError && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" style={{ fontSize: "0.8125rem" }}>{operationError}</p>}
        <div className="py-2">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <SmartphoneNfc className="w-7 h-7 text-amber-500" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-[#1A1A1A] dark:text-zinc-100 text-center" style={{ fontSize: "0.9375rem" }}>
            ¿Resetear el dispositivo vinculado de <strong>{resetDeviceTarget?.nombre_completo}</strong>?
          </p>
          <p className="text-[#1A1A1A]/50 dark:text-zinc-500 mt-3 text-center" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
            El empleado podrá volver a fichar desde cualquier celular, y ese nuevo dispositivo quedará vinculado automáticamente.
          </p>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setResetDeviceTarget(null)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/70 hover:bg-gray-50 transition-colors" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            Cancelar
          </button>
          <button
            onClick={handleResetDevice}
            disabled={resetting}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            {resetting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Reseteando...</>
            ) : (
              <><SmartphoneNfc className="w-4 h-4" />Resetear vinculación</>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
