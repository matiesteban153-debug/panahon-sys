/**
 * api.ts – Data layer using direct Supabase queries against real tables.
 * Tables: empresas, perfiles_admin, empleados, registros
 * RPCs: get_empleados_por_qr, resumen_mensual, cerrar_registros_antiguos
 *
 * NOTE: fichar_entrada / fichar_salida / get_estado_empleado have been moved
 * to dedicated server endpoints so they can (a) use SERVICE_ROLE to bypass
 * RLS, and (b) receive the LOCAL date from the browser to avoid the UTC-3
 * timezone bug that affected Argentina-based businesses.
 */
import { loadClient } from "./supabase";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { calcularPago } from "./payroll";
import type { ConfigPago } from "./payroll";

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-bdf30ab0`;

/** Ensure Supabase client is ready before making queries */
async function getClient() {
  return await loadClient();
}

// ─── Helpers ───

/** Convert decimal hours (e.g. 8.75) to "8 hs 45 min" */
export function formatDecimalHours(val: number | null | undefined): string {
  if (val == null || val === 0) return "0 hs";
  const hours = Math.floor(val);
  const mins = Math.round((val - hours) * 60);
  return mins > 0 ? `${hours} hs ${mins} min` : `${hours} hs`;
}

/** Convert a UTC timestamptz string to local HH:MM */
export function formatTimeLocal(ts: string | null): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format a date string (YYYY-MM-DD) to DD/MM */
export function formatDateShort(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Returns today's date as YYYY-MM-DD using the BROWSER's local timezone.
 * This is the key fix for the UTC-3 bug: never use new Date().toISOString()
 * when you need the local calendar date.
 */
function getLocalDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Empleados (admin, requires auth) ───

export async function getEmployees(empresaId: string) {
  const client = await getClient();
  const { data, error } = await client
    .from("empleados")
    .select("id, nombre_completo, email, tipo_jornada, valor_hora, sueldo_base_mensual, jornada_horas, activo, device_id")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("nombre_completo");

  if (error) {
    console.error("Error fetching empleados:", error);
    throw error;
  }
  return data || [];
}

export async function saveEmployee(
  empresaId: string,
  employee: {
    id?: string;
    nombre_completo: string;
    email?: string;
    tipo_jornada: "por_hora" | "mensual" | "jornada";
    valor_hora: number;
    sueldo_base_mensual?: number | null;
    valor_jornada?: number | null;
    jornada_horas: number;
    activo?: boolean;
  }
) {
  const client = await getClient();
  const fields: Record<string, any> = {
    nombre_completo: employee.nombre_completo,
    email: employee.email || null,
    tipo_jornada: employee.tipo_jornada,
    valor_hora: employee.tipo_jornada === "por_hora" ? employee.valor_hora : 0,
    sueldo_base_mensual: employee.tipo_jornada === "mensual" ? (employee.sueldo_base_mensual ?? null) : null,
    jornada_horas: employee.jornada_horas,
    activo: employee.activo ?? true,
  };
  // Only include valor_jornada when saving a jornada employee — avoids writing to a
  // column that might not exist yet for por_hora / mensual updates.
  if (employee.tipo_jornada === "jornada") {
    fields.valor_jornada = employee.valor_jornada ?? null;
  }
  if (employee.id) {
    const { error } = await client.from("empleados").update(fields).eq("id", employee.id);
    if (error) { console.error("Error updating empleado:", error); throw error; }
  } else {
    const { error } = await client.from("empleados").insert({ empresa_id: empresaId, ...fields });
    if (error) { console.error("Error inserting empleado:", error); throw error; }
  }
}

export async function deleteEmployee(empleadoId: string) {
  const client = await getClient();
  // Soft delete
  const { error } = await client
    .from("empleados")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", empleadoId);
  if (error) {
    console.error("Error soft-deleting empleado:", error);
    throw error;
  }
}

// ─── Registros (admin, requires auth) ───

export async function getRegistros(
  empresaId: string,
  desdeDate: string,
  hastaDate: string,
  empleadoId?: string
) {
  const client = await getClient();

  let query = client
    .from("registros")
    .select(
      "id, fecha, hora_entrada, hora_salida, horas_totales, sueldo_dia, valor_hora_snapshot, editado_manual, nota_interna, empleado_id, sospechoso, motivo_sospecha, estado, eliminado, empleados(nombre_completo, tipo_jornada)"
    )
    .eq("empresa_id", empresaId)
    .gte("fecha", desdeDate)
    .lte("fecha", hastaDate)
    .order("fecha", { ascending: false });

  // Add employee filter if selected
  if (empleadoId && empleadoId !== "all") {
    query = query.eq("empleado_id", empleadoId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching registros:", error);
    throw error;
  }
  // Filter out soft-deleted records in JS: handles column-not-existing (undefined)
  // and null values gracefully — only hides records explicitly marked true.
  return (data || []).filter((r: any) => r.eliminado !== true);
}

export async function countSuspiciousRecords(
  empresaId: string,
  year: number,
  month: number
) {
  const client = await getClient();
  
  // Calculate first and last day of the month
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  
  const baseQuery = () =>
    client
      .from("registros")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("sospechoso", true)
      .gte("fecha", firstDay)
      .lte("fecha", lastDayStr);

  // Try with eliminado filter; if column doesn't exist yet, fall back without it
  let { count, error } = await baseQuery().eq("eliminado", false);
  if (error) {
    ({ count, error } = await baseQuery());
  }
  if (error) {
    console.error("Error counting suspicious records:", error);
    throw error;
  }
  return count || 0;
}

export async function countIncompleteRecords(empresaId: string) {
  const client = await getClient();

  // Use LOCAL date so Argentina UTC-3 doesn't shift the boundary to yesterday
  const today = getLocalDateString();

  const baseQuery = () =>
    client
      .from("registros")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .is("hora_salida", null)
      .lte("fecha", today);

  // Try with eliminado filter; if column doesn't exist yet, fall back without it
  let { count, error } = await baseQuery().eq("eliminado", false);
  if (error) {
    ({ count, error } = await baseQuery());
  }
  if (error) {
    console.error("Error counting incomplete records:", error);
    throw error;
  }
  return count || 0;
}

export async function updateRegistro(
  registroId: string,
  data: {
    hora_entrada?: string;
    hora_salida?: string | null;
    nota_interna?: string;
  }
) {
  const client = await getClient();
  const { error } = await client
    .from("registros")
    .update({
      ...data,
      editado_manual: true,
    })
    .eq("id", registroId);
  if (error) {
    console.error("Error updating registro:", error);
    throw error;
  }
}

export async function eliminarRegistro(
  registroId: string,
  motivo: string,
  adminId: string
) {
  const client = await getClient();
  const { error } = await client
    .from("registros")
    .update({
      eliminado: true,
      eliminado_at: new Date().toISOString(),
      eliminado_por: adminId,
      motivo_eliminacion: motivo.trim(),
    })
    .eq("id", registroId);
  if (error) {
    console.error("Error eliminando registro:", error);
    throw error;
  }
}

export async function getRegistrosEliminados(empresaId: string) {
  const client = await getClient();
  const { data, error } = await client
    .from("registros")
    .select("id, fecha, hora_entrada, hora_salida, horas_totales, eliminado_at, motivo_eliminacion, empleado_id, empleados(nombre_completo)")
    .eq("empresa_id", empresaId)
    .eq("eliminado", true)
    .order("eliminado_at", { ascending: false });
  if (error) {
    console.error("Error fetching registros eliminados:", error);
    throw error;
  }
  return data || [];
}

export async function dividirRegistro(
  registroId: string,
  horaSalida1: string,
  fecha2: string,
  horaEntrada2: string,
  horaSalida2: string
) {
  const client = await getClient();
  const { data, error } = await client.rpc("dividir_registro", {
    p_registro_id: registroId,
    p_hora_salida_1: horaSalida1,
    p_fecha_2: fecha2,
    p_hora_entrada_2: horaEntrada2,
    p_hora_salida_2: horaSalida2,
  });
  
  if (error) {
    console.error("Error dividiendo registro:", error);
    throw error;
  }
  
  return data;
}

// ─── Resumen mensual (admin, RPC) ───

export async function getResumenMensual(
  empresaId: string,
  year: number,
  month: number
) {
  const client = await getClient();
  const { data, error } = await client.rpc("resumen_mensual", {
    p_empresa_id: empresaId,
    p_anio: year,
    p_mes: month,
  });

  if (error) {
    console.error("Error fetching resumen_mensual:", error);
    throw error;
  }
  return data || [];
}

// ─── Resumen por rango de fechas (admin, direct query) ───

export async function getResumenPorRango(
  empresaId: string,
  desdeDate: string,
  hastaDate: string
) {
  const client = await getClient();

  // valor_jornada is fetched separately — it may not exist as a column yet.
  const { data: registros, error } = await client
    .from("registros")
    .select(`
      id, fecha, hora_entrada, hora_salida, horas_totales,
      sueldo_dia, valor_hora_snapshot, empleado_id, eliminado,
      empleados (id, nombre_completo, valor_hora, tipo_jornada, sueldo_base_mensual)
    `)
    .eq("empresa_id", empresaId)
    .gte("fecha", desdeDate)
    .lte("fecha", hastaDate)
    .not("empleados", "is", null);

  if (error) {
    console.error("Error fetching resumen por rango:", error);
    throw error;
  }

  // Group records by employee
  const byEmployee: Record<string, { emp: any; regs: any[] }> = {};
  for (const reg of (registros || [])) {
    if (!reg.empleado_id || !reg.empleados) continue;
    if (!byEmployee[reg.empleado_id]) {
      byEmployee[reg.empleado_id] = { emp: reg.empleados, regs: [] };
    }
    byEmployee[reg.empleado_id].regs.push(reg);
  }

  // Fetch valor_jornada for jornada employees (column may not exist yet)
  const jornadaIds = Object.entries(byEmployee)
    .filter(([, { emp }]) => emp.tipo_jornada === "jornada")
    .map(([id]) => id);
  const valorJornadaMap: Record<string, number | null> = {};
  if (jornadaIds.length > 0) {
    try {
      const { data } = await client
        .from("empleados")
        .select("id, valor_jornada")
        .in("id", jornadaIds);
      (data || []).forEach((e: any) => {
        valorJornadaMap[e.id] = e.valor_jornada ?? null;
      });
    } catch {
      // valor_jornada column doesn't exist yet — jornada totals will show $0
    }
  }

  // The holiday calendar is read independently of the registros query. This
  // keeps all payment modes aligned without relying on historical sueldo_dia.
  const feriados = await getFeriadosByRango(desdeDate, hastaDate);
  const multiplicadoresFeriado = new Map(
    feriados.map((feriado) => [feriado.fecha, feriado.multiplicador || 2]),
  );

  // Build summary using the shared calcularPago engine
  return Object.entries(byEmployee).map(([empId, { emp, regs }]) => {
    const config: ConfigPago = {
      tipo_jornada: emp.tipo_jornada || "por_hora",
      valor_hora: emp.valor_hora ?? 0,
      valor_jornada: valorJornadaMap[empId] ?? null,
      sueldo_base_mensual: emp.sueldo_base_mensual ?? null,
    };
    const { horas_totales, dias_trabajados, total_a_pagar } = calcularPago(regs, config, multiplicadoresFeriado);
    return {
      empleado_id: empId,
      nombre_completo: emp.nombre_completo,
      tipo_jornada: config.tipo_jornada,
      valor_hora: emp.valor_hora || 0,
      sueldo_base_mensual: emp.sueldo_base_mensual ?? null,
      valor_jornada: valorJornadaMap[empId] ?? null,
      dias_trabajados,
      horas_totales,
      total_a_pagar,
    };
  });
}

// ─── Empresa config (admin, direct query) ───

export async function getEmpresa(empresaId: string) {
  const client = await getClient();
  const { data, error } = await client
    .from("empresas")
    .select("*")
    .eq("id", empresaId)
    .single();

  if (error) {
    console.error("Error fetching empresa:", error);
    throw error;
  }
  return data;
}

export async function updateEmpresa(
  empresaId: string,
  // qr_token is immutable after creation and is excluded from this type.
  updates: {
    nombre?: string;
    rubro?: string;
    email_contacto?: string;
    valor_hora_default?: number;
    jornada_default?: number;
    latitud?: number | null;
    longitud?: number | null;
    radio_metros?: number | null;
    terminos_aceptados?: boolean;
    terminos_aceptados_at?: string | null;
  }
) {
  // Strip immutable columns before writing — guards against future type changes or casts.
  const { qr_token: _qr, id: _id, ...safeUpdates } = updates as Record<string, unknown>;

  const client = await getClient();
  const { error } = await client
    .from("empresas")
    .update(safeUpdates)
    .eq("id", empresaId);
  if (error) {
    console.error("Error updating empresa:", error);
    throw error;
  }
}

/** Fetches the tenant-level acceptance flag used by the mandatory legal gate. */
export async function getTerminosAceptados(empresaId: string): Promise<boolean> {
  const client = await getClient();
  const { data, error } = await client
    .from("empresas")
    .select("terminos_aceptados")
    .eq("id", empresaId)
    .single();
  if (error) throw error;
  return data?.terminos_aceptados === true;
}

/** Records a one-time, company-wide acceptance timestamp. */
export async function aceptarTerminos(empresaId: string): Promise<void> {
  await updateEmpresa(empresaId, {
    terminos_aceptados: true,
    terminos_aceptados_at: new Date().toISOString(),
  });
}

// ─── Fichaje (public, via server endpoints — bypasses RLS, uses local date) ───

export async function getEmpleadosPorQR(qrToken: string) {
  const client = await getClient();
  const { data, error } = await client.rpc("get_empleados_por_qr", {
    p_qr_token: qrToken,
  });
  if (error) {
    console.error("Error fetching empleados por QR:", error);
    throw error;
  }
  return data || [];
}

export async function getEstadoEmpleado(
  qrToken: string,
  empleadoId: string
) {
  const localDate = getLocalDateString();

  const res = await fetch(`${SERVER_URL}/fichaje/estado`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({ qrToken, empleadoId, localDate }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Error fetching estado empleado:", err);
    throw new Error(err.error || "Error al obtener estado del empleado");
  }

  const data = await res.json();
  // Server returns an array (same shape as the old RPC)
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export const PLAN_VENCIDO_DEFAULT_MSG =
  "El período de prueba o suscripción de la empresa ha finalizado. Por favor, comunícate con tu administrador para renovar el plan.";

export interface EstadoSuscripcionEmpleado {
  valido: boolean;
  codigo?: string;
  mensaje?: string;
}

/**
 * Calls the RPC `verificar_estado_empresa_empleado` passing `empleado_id`.
 * Handles both `p_empleado_id` and `empleado_id` parameter naming conventions,
 * as well as array or object return types from PostgREST.
 */
export async function verificarEstadoEmpresaEmpleado(
  empleadoId: string
): Promise<EstadoSuscripcionEmpleado> {
  const client = await getClient();

  let { data, error } = await client.rpc("verificar_estado_empresa_empleado", {
    p_empleado_id: empleadoId,
  });

  // Fallback if the SQL function parameter is named `empleado_id` instead of `p_empleado_id`
  if (error && (error.code === "PGRST202" || error.message?.includes("p_empleado_id"))) {
    const retry = await client.rpc("verificar_estado_empresa_empleado", {
      empleado_id: empleadoId,
    });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.warn("[Suscripción] Error consultando verificar_estado_empresa_empleado:", error.message);
    return { valido: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { valido: true };
  }

  const valido = row.valido !== false;
  const codigo = row.codigo ?? row.code ?? (valido ? undefined : "PLAN_VENCIDO");
  const mensaje =
    row.mensaje ??
    row.message ??
    (!valido ? PLAN_VENCIDO_DEFAULT_MSG : undefined);

  return { valido, codigo, mensaje };
}

export async function ficharEntrada(
  qrToken: string,
  empleadoId: string,
  location?: { latitude: number; longitude: number } | null,
  deviceId?: string,
  biometricProof?: string
) {
  const localDate = getLocalDateString();
  const body: Record<string, unknown> = { qrToken, empleadoId, localDate };
  if (location) {
    body.userLat = location.latitude;
    body.userLng = location.longitude;
  }
  if (deviceId) body.deviceId = deviceId;
  if (biometricProof) body.biometricProof = biometricProof;

  const res = await fetch(`${SERVER_URL}/fichaje/entrada`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.success === false) {
    console.error("Error fichando entrada:", data);
    return {
      success: false,
      codigo: data.codigo || data.code,
      error: data.error || "Error al fichar entrada",
    };
  }
  return data;
}

export async function ficharSalida(
  qrToken: string,
  empleadoId: string,
  location?: { latitude: number; longitude: number } | null,
  deviceId?: string,
  biometricProof?: string,
  registroId?: string | null
) {
  const body: Record<string, unknown> = { qrToken, empleadoId };
  if (registroId) body.registroId = registroId;
  if (location) {
    body.userLat = location.latitude;
    body.userLng = location.longitude;
  }
  if (deviceId) body.deviceId = deviceId;
  if (biometricProof) body.biometricProof = biometricProof;

  const res = await fetch(`${SERVER_URL}/fichaje/salida`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.success === false) {
    console.error("Error fichando salida:", data);
    return {
      success: false,
      codigo: data.codigo || data.code,
      error: data.error || "Error al fichar salida",
    };
  }
  return data;
}

// ─── Cerrar registros antiguos (admin) ───

export async function cerrarRegistrosAntiguos(empresaId: string) {
  const client = await getClient();
  const { data, error } = await client.rpc("cerrar_registros_antiguos", {
    p_empresa_id: empresaId,
  });
  if (error) {
    console.error("Error cerrando registros antiguos:", error);
    throw error;
  }
  return data;
}

// ─── Empresa name from QR token (for fichaje header) ───

export async function getEmpresaByQRToken(qrToken: string) {
  const client = await getClient();
  const { data, error } = await client
    .from("empresas")
    .select("id, nombre")
    .eq("qr_token", qrToken)
    .single();

  if (error) {
    console.error("Error fetching empresa by QR token:", error);
    throw error;
  }
  return data;
}

// ─── Feriados (admin, via server — bypasses RLS) ─────────────────────────────
// The feriados table has RLS enabled with no permissive policies for the anon
// key, so all CRUD goes through the server using the SERVICE_ROLE_KEY.
// The server verifies the admin JWT and scopes every operation to their empresa.

export interface Feriado {
  id: string;
  empresa_id: string;
  fecha: string;
  descripcion: string;
  multiplicador: number;
}

/** Get the current session's access token (needed for admin server routes). */
// In-memory token cache. Concurrent admin calls (Dashboard makes several) must
// share a refresh request: rotating a refresh token more than once in parallel
// can invalidate the other request and incorrectly look like a logged-out user.
let _cachedToken: string | null = null;
let _cachedTokenExpiry = 0;
let _tokenRefreshPromise: Promise<string> | null = null;

function sessionExpiredError() {
  const error = new Error("Tu sesión expiró. Iniciá sesión de nuevo.");
  error.name = "SessionExpiredError";
  return error;
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof Error && error.name === "SessionExpiredError";
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const nowMs = Date.now();

  // A one-minute buffer absorbs server clock skew without forcing a refresh on
  // every Dashboard load.
  if (!forceRefresh && _cachedToken && _cachedTokenExpiry > nowMs + 60_000) {
    return _cachedToken;
  }

  const client = await getClient();

  // Prefer the current valid session. Calling refreshSession unconditionally
  // was the source of spurious "Tu sesión expiró" errors in Dashboard.
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;
  const sessionExpiry = (session as any)?.expires_at as number | undefined;
  if (!forceRefresh && session?.access_token && (!sessionExpiry || sessionExpiry * 1000 > nowMs + 60_000)) {
    _cachedToken = session.access_token;
    _cachedTokenExpiry = sessionExpiry ? sessionExpiry * 1000 : nowMs + 3_600_000;
    return _cachedToken;
  }

  if (!_tokenRefreshPromise) {
    _tokenRefreshPromise = client.auth.refreshSession().then(({ data: refreshed, error: refreshErr }: any) => {
      if (refreshErr || !refreshed?.session?.access_token) {
        _cachedToken = null;
        _cachedTokenExpiry = 0;
        // Keep AuthProvider in sync with the failed refresh. Its session guard
        // will take the user back to login instead of leaving Dashboard broken.
        client.auth.signOut({ scope: "local" }).catch(() => undefined);
        throw sessionExpiredError();
      }
      const expAt = refreshed.session.expires_at as number | undefined;
      _cachedToken = refreshed.session.access_token;
      _cachedTokenExpiry = expAt ? expAt * 1000 : Date.now() + 3_600_000;
      return _cachedToken;
    }).finally(() => {
      _tokenRefreshPromise = null;
    });
  }

  return _tokenRefreshPromise;
}

/**
 * Calls protected admin routes and retries once with a forced session refresh
 * when the Edge Function rejects an otherwise cached JWT.
 */
async function fetchAdminRoute(url: string, init: RequestInit = {}): Promise<Response> {
  const request = async (forceRefresh = false) => {
    const token = await getAccessToken(forceRefresh);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  let response = await request();
  if (response.status === 401) {
    _cachedToken = null;
    _cachedTokenExpiry = 0;
    response = await request(true);
    if (response.status === 401) {
      const client = await getClient();
      client.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw sessionExpiredError();
    }
  }
  return response;
}

/**
 * Returns future feriados (fecha >= today) for the authenticated admin's empresa.
 */
export async function getFeriados(_empresaId: string): Promise<Feriado[]> {
  const res = await fetchAdminRoute(`${SERVER_URL}/admin/feriados`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Error fetching feriados:", err);
    throw new Error(err.error || "Error al obtener feriados");
  }
  return res.json();
}

/**
 * Returns feriados for a specific date range (desde..hasta) for the admin's empresa.
 * Used by the weekly matrix view to highlight feriado cells.
 */
export async function getFeriadosByRango(desde: string, hasta: string): Promise<Feriado[]> {
  const res = await fetchAdminRoute(
    `${SERVER_URL}/admin/feriados?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Error fetching feriados por rango:", err);
    throw new Error(err.error || "Error al obtener feriados");
  }
  return res.json();
}

/**
 * Insert a new feriado for the authenticated admin's empresa.
 * Throws with a user-friendly message on duplicate date (UNIQUE constraint).
 */
export async function createFeriado(
  _empresaId: string,
  payload: { fecha: string; descripcion: string; multiplicador: number }
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/feriados`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error creating feriado:", data);
    throw Object.assign(new Error(data.error || "Error al guardar el feriado"), { code: String(res.status) });
  }
}

/** Delete a feriado by id (server verifies it belongs to the admin's empresa). */
export async function deleteFeriado(feriadoId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/feriados/${feriadoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Error deleting feriado:", err);
    throw new Error(err.error || "Error al eliminar el feriado");
  }
}

// ─── Carga Manual de Turnos (admin, via server) ───────────────────────────────

export interface CargarTurnoPayload {
  empleado_id: string;
  fecha: string;            // YYYY-MM-DD (local date)
  hora_entrada: string;     // HH:MM
  hora_salida?: string | null; // HH:MM — optional; null saves an open record
  nota_interna?: string;
  registro_id?: string;     // if provided → UPDATE existing record; if omitted → INSERT new row
}

export interface CargarTurnoResult {
  horas_totales: number | null;
  sueldo_dia: number | null;
  es_feriado: boolean;
  feriado_descripcion: string | null;
}

/**
 * Upserts a manual registro via the server endpoint.
 * The server calculates horas_totales, checks feriados, and stores
 * estado='Editado' + editado_manual=true.
 */
export async function cargarTurnoManual(payload: CargarTurnoPayload): Promise<CargarTurnoResult> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/registros/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Error en carga manual:", data);
    throw new Error(data.error || "Error al guardar el registro");
  }
  return data as CargarTurnoResult;
}

export async function resetEmpleadoDevice(
  empleadoId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/admin/empleados/${empleadoId}/reset-device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al resetear dispositivo");
  }
}

// ─── Alertas de seguridad (admin, via server) ─────────────────────────────────

export interface AlertaSeguridad {
  id: string;
  tipo_evento: string;
  tipo_fichaje: string;
  created_at: string;
  device_id_recibido: string | null;
  device_id_registrado: string | null;
  latitud: number | null;
  longitud: number | null;
  descripcion: string | null;
  revisado: boolean;
  empleado_id: string;
  empleados: { nombre_completo: string } | null;
}

export async function getAlertasCount(): Promise<number> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/alertas/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const data = await res.json().catch(() => ({ count: 0 }));
  return data.count ?? 0;
}

export async function getAlertas(params?: {
  tipo?: string;
  revisado?: boolean | null;
}): Promise<AlertaSeguridad[]> {
  const token = await getAccessToken();
  const qs = new URLSearchParams();
  if (params?.tipo && params.tipo !== "todos") qs.set("tipo", params.tipo);
  if (params?.revisado != null) qs.set("revisado", String(params.revisado));
  const url = `${SERVER_URL}/admin/alertas${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al obtener alertas");
  }
  return res.json();
}

export async function marcarAlertaRevisada(alertaId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/alertas/${alertaId}/revisar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al marcar alerta como revisada");
  }
}

export async function marcarTodasRevisadas(): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SERVER_URL}/admin/alertas/revisar-todas`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al marcar todas las alertas");
  }
}
