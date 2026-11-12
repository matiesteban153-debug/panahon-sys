/**
 * Demo mode configuration
 *
 * The demo account must exist in Supabase linked to the empresa DEMO-PANAHON-001.
 * Change these credentials to match the actual demo user in your Supabase project.
 */
export const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || "demo@panahon.app";
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || "demo-panahon-2025";

/**
 * Routes the demo user cannot access.
 * Redirects silently to /admin on attempt.
 */
export const DEMO_RESTRICTED_PATHS = [
  "/admin/suscripcion",
  "/admin/configuracion",
];

/** Returns true if the given email belongs to the demo account. */
export function isDemoUser(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === DEMO_EMAIL.toLowerCase();
}
