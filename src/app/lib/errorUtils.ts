/**
 * Translates errors from Supabase, Edge Functions and the browser into clear,
 * actionable messages for the people using Panahon. Raw errors are still safe
 * to log for diagnostics, but they must never be rendered directly.
 */
type ErrorLike = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
  statusCode?: unknown;
  name?: unknown;
};

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorFields(error: unknown) {
  if (typeof error === "string") {
    return { message: error, code: "", status: 0 };
  }

  if (error && typeof error === "object") {
    const source = error as ErrorLike;
    const nested = source.error && typeof source.error === "object" ? source.error as ErrorLike : null;
    return {
      message: readText(source.message) || readText(source.error) || readText(nested?.message),
      code: String(source.code || nested?.code || "").toUpperCase(),
      status: Number(source.status || source.statusCode || nested?.status || nested?.statusCode || 0),
    };
  }

  return { message: "", code: "", status: 0 };
}

/** Returns a Spanish message that can be displayed safely in the UI. */
export function getFriendlyError(error: unknown, fallback = "No pudimos completar la operación. Intentá de nuevo."): string {
  const { message, code, status } = errorFields(error);
  const normalized = `${message} ${code}`.toLowerCase();

  // Connectivity must take precedence over API wording: an unavailable server
  // is not the same as a missing user or an invalid form.
  if (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("network error") ||
    normalized.includes("load failed") ||
    normalized.includes("err_network") ||
    normalized.includes("econn") ||
    normalized.includes("timeout") ||
    normalized.includes("aborterror")
  ) {
    return "No pudimos conectarnos. Revisá tu conexión a internet e intentá nuevamente.";
  }

  if (status >= 500 || normalized.includes("internal server error") || normalized.includes("edge function")) {
    return "El servicio no está disponible en este momento. Esperá unos minutos e intentá nuevamente.";
  }

  // Auth/session errors from GoTrue, PostgREST and JWT validation.
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid_credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return normalized.includes("confirmed")
      ? "Confirmá tu email antes de iniciar sesión."
      : "El email o la contraseña no son correctos.";
  }
  if (
    normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "Ya existe una cuenta registrada con ese email.";
  }
  if (
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("token") ||
    normalized.includes("not authenticated") ||
    status === 401
  ) {
    return "Tu sesión venció o ya no es válida. Iniciá sesión nuevamente para continuar.";
  }
  if (status === 403 || normalized.includes("permission denied") || normalized.includes("not authorized")) {
    return "No tenés permisos para realizar esta acción. Consultá con la persona administradora.";
  }

  // PostgreSQL constraint errors. Do not expose a constraint name or SQL details.
  if (code === "23514" || normalized.includes("check constraint") || normalized.includes("chk_horas_nonnegative")) {
    if (normalized.includes("hora") || normalized.includes("horas") || normalized.includes("nonnegative")) {
      return "Las horas ingresadas no pueden ser negativas. Revisá la entrada, la salida y la duración del turno.";
    }
    return "Los datos ingresados no cumplen las reglas del registro. Revisá las horas y los valores antes de guardar.";
  }
  if (code === "23505" || normalized.includes("duplicate key") || normalized.includes("unique constraint")) {
    if (normalized.includes("email")) return "Ya existe un empleado o una cuenta con ese email.";
    return "Ya existe un registro con esos datos. Revisá la información antes de guardar.";
  }
  if (code === "23503" || normalized.includes("foreign key")) {
    return "No se pudo completar la acción porque el dato relacionado ya no está disponible. Actualizá la página e intentá de nuevo.";
  }
  if (code === "23502" || normalized.includes("not-null") || normalized.includes("null value")) {
    return "Falta completar un dato obligatorio. Revisá el formulario e intentá de nuevo.";
  }
  if (code.startsWith("PGRST")) {
    return "No pudimos obtener la información solicitada. Actualizá la página e intentá nuevamente.";
  }

  // Known, safe domain messages from the fichaje endpoint can be reused.
  if (normalized.includes("geovalla") || normalized.includes("fuera del rango") || normalized.includes("fuera de rango")) {
    return "Estás fuera del área habilitada para fichar. Acercate al lugar de trabajo e intentá nuevamente.";
  }
  if (normalized.includes("ya registraste tu entrada") || normalized.includes("ya completaste tu jornada")) {
    return message;
  }

  return fallback;
}
