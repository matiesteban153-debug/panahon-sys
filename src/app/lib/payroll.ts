/**
 * payroll.ts — Centralised pay calculation engine.
 *
 * Pure functions only — no Supabase calls, no side effects.
 * Used by getResumenPorRango (api.ts), DashboardPage, ReportesPage,
 * and ReporteEmpleadoModal so every total is computed identically.
 */

export type TipoPago = "por_hora" | "mensual" | "jornada";

/** Minimum fields needed from a registro to run payroll */
export interface RegistroPago {
  fecha: string;
  hora_salida: string | null;
  horas_totales: number | null;
  /** Server-computed daily wage (includes feriado ×2 when applicable) */
  sueldo_dia: number | null;
  /** Hourly rate snapshotted at clock-in time */
  valor_hora_snapshot?: number | null;
  /** Soft-delete flag — records with eliminado === true are excluded */
  eliminado?: boolean | null;
}

/** Pay configuration for one employee */
export interface ConfigPago {
  tipo_jornada: TipoPago;
  /** Used when tipo_jornada === "por_hora" */
  valor_hora?: number | null;
  /** Used when tipo_jornada === "jornada" */
  valor_jornada?: number | null;
  /** Used when tipo_jornada === "mensual" */
  sueldo_base_mensual?: number | null;
}

export interface ResumenPago {
  horas_totales: number;
  dias_trabajados: number;
  total_a_pagar: number;
}

/** A holiday date mapped to its payroll multiplier (normally 2). */
export type FeriadosPago = ReadonlyMap<string, number> | ReadonlySet<string>;

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function getMultiplicadorFeriado(fecha: string, feriados?: FeriadosPago): number {
  if (!feriados || !feriados.has(fecha)) return 1;
  const multiplicador = feriados instanceof Map ? feriados.get(fecha) : 2;
  return typeof multiplicador === "number" && multiplicador > 0 ? multiplicador : 2;
}

/**
 * Calculates the amount attributable to a single completed record.
 * The rate snapshot is preferred so later employee rate changes never alter
 * already worked shifts. `sueldo_dia` remains a compatibility fallback for
 * legacy rows without a rate snapshot (it was stored with its holiday rate).
 */
export function calcularImporteRegistro(
  registro: RegistroPago,
  config: ConfigPago,
  feriados?: FeriadosPago,
): number {
  if (registro.eliminado === true || !registro.hora_salida || config.tipo_jornada === "mensual") {
    return 0;
  }

  const multiplicador = getMultiplicadorFeriado(registro.fecha, feriados);
  if (config.tipo_jornada === "jornada") {
    return redondearMoneda((config.valor_jornada || 0) * multiplicador);
  }

  const valorHora = registro.valor_hora_snapshot ?? config.valor_hora;
  if (valorHora != null) {
    return redondearMoneda((registro.horas_totales || 0) * valorHora * multiplicador);
  }
  return registro.sueldo_dia || 0;
}

/**
 * Calculate pay for one employee over any date range.
 *
 * Rules:
 *  - "por_hora" → Σ (horas × valor_hora_snapshot) × multiplicador de feriado
 *  - "jornada"  → Σ valor_jornada × multiplicador por cada fecha distinta
 *  - "mensual"  → fixed sueldo_base_mensual regardless of hours worked
 *
 * Soft-deleted records (eliminado === true) and incomplete records
 * (hora_salida is null) are excluded from all calculations.
 */
export function calcularPago(
  registros: RegistroPago[],
  config: ConfigPago,
  feriados?: FeriadosPago,
): ResumenPago {
  const completos = registros.filter(
    (r) => r.eliminado !== true && r.hora_salida,
  );
  const horas_totales = completos.reduce(
    (s, r) => s + (r.horas_totales || 0),
    0,
  );
  const diasSet = new Set(completos.map((r) => r.fecha));

  if (config.tipo_jornada === "mensual") {
    return {
      horas_totales,
      dias_trabajados: diasSet.size,
      total_a_pagar: config.sueldo_base_mensual || 0,
    };
  }

  if (config.tipo_jornada === "jornada") {
    const dias = diasSet.size;
    const total = [...diasSet].reduce(
      (s, fecha) => s + (config.valor_jornada || 0) * getMultiplicadorFeriado(fecha, feriados),
      0,
    );
    return {
      horas_totales,
      dias_trabajados: dias,
      total_a_pagar: redondearMoneda(total),
    };
  }

  // por_hora: each record is rounded before the sum, matching the stored wage.
  const total_a_pagar = redondearMoneda(
    completos.reduce((s, r) => s + calcularImporteRegistro(r, config, feriados), 0),
  );

  return { horas_totales, dias_trabajados: diasSet.size, total_a_pagar };
}
