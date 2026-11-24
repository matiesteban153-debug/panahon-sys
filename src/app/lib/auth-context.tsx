import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import * as Sentry from "@sentry/react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { useIdleTimeout } from "./useIdleTimeout";
import { IdleWarningModal } from "../components/admin/IdleWarningModal";
import { trackEvent } from "./telemetry";
import { getFriendlyError } from "./errorUtils";
import { isDemoUser } from "./demo";

const supabaseUrl = `https://${projectId}.supabase.co`;
const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-bdf30ab0`;

interface AdminProfile {
  id: string;
  empresa_id: string;
  nombre_completo: string;
  email: string;
  rol: string;
}

interface AuthSession {
  access_token: string;
  user: { id: string; email?: string; user_metadata?: any };
}

interface AuthContextType {
  session: AuthSession | null;
  admin: AdminProfile | null;
  loading: boolean;
  adminLoading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    metadata: {
      nombre_completo: string;
      empresa_nombre: string;
      rubro: string;
      cantidad_empleados: string;
      valor_hora_defecto: number;
    }
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const supabaseRef = useRef<any>(null);

  // ── Idle timeout: 5 minutos de inactividad -> Cartel de 10 minutos -> Extensión de 10m ──
  const {
    isWarningVisible,
    remainingSeconds,
    continueSession,
    logout: idleLogout,
  } = useIdleTimeout({
    onIdle: async () => {
      console.log("[Auth] Inactividad alcanzada sin respuesta, cerrando sesión");
      const client = supabaseRef.current;
      if (client) {
        try {
          await client.auth.signOut();
        } catch (err: any) {
          console.error("[Auth] Error al cerrar sesión por inactividad:", err);
        }
      }
      setSession(null);
      setAdmin(null);
      setAdminLoading(false);
    },
    initialIdleTime: 5 * 60 * 1000, // 5 minutos iniciales
    extendedIdleTime: 10 * 60 * 1000, // 10 minutos si el usuario mantiene la sesión
    warningDuration: 10 * 60, // 10 minutos dura el cartel
    enabled: !!session, // Solo activar cuando hay sesión activa
  });

  // ── Sync Sentry user with auth session ──
  useEffect(() => {
    if (session?.user) {
      Sentry.setUser({
        id: session.user.id,
        email: session.user.email ?? undefined,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  // ── Fallback ONLY for verified demo account if DB query fails (Finding C4) ──
  const getDemoFallbackProfile = (s: any): AdminProfile | null => {
    const email = s?.user?.email;
    if (!email || !isDemoUser(email)) return null;
    return {
      id: s.user.id,
      empresa_id: "e1769ac7-80d1-43d3-a09b-15b9345d1737",
      nombre_completo: "Usuario Demo",
      email,
      rol: "demo",
    };
  };

  // ── Fetch profile from perfiles_admin via direct REST call ──
  const fetchAdminProfile = async (
    _client: any,
    s: any
  ): Promise<AdminProfile | null> => {
    const userId = s?.user?.id;
    const accessToken = s?.access_token;
    if (!userId || !accessToken) {
      console.warn("[Auth] fetchAdminProfile: no userId or accessToken");
      return getDemoFallbackProfile(s);
    }

    console.log("[Auth] fetchAdminProfile: fetching via REST for user", userId);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const url = `${supabaseUrl}/rest/v1/perfiles_admin?select=id,empresa_id,nombre_completo,email,rol&id=eq.${userId}`;
      const res = await fetch(url, {
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.pgrst.object+json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      console.log("[Auth] fetchAdminProfile: REST response status", res.status);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[Auth] fetchAdminProfile: REST error", res.status, body);
        return getDemoFallbackProfile(s);
      }

      const data = await res.json();
      if (data && data.id && data.empresa_id) {
        console.log("[Auth] fetchAdminProfile: got profile from DB, empresa_id:", data.empresa_id);
        return data as AdminProfile;
      }

      console.warn("[Auth] fetchAdminProfile: no profile row found in DB");
      return getDemoFallbackProfile(s);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn("[Auth] fetchAdminProfile: request aborted after 6s timeout");
      } else {
        console.warn("[Auth] fetchAdminProfile: fetch exception:", err.message);
      }
      return getDemoFallbackProfile(s);
    }
  };

  // ── Load admin profile in background ──
  const loadAdminInBackground = (client: any, s: any) => {
    setAdminLoading(true);
    fetchAdminProfile(client, s)
      .then((profile) => {
        console.log("[Auth] loadAdminInBackground: resolved, setting admin", profile ? profile.id : "null");
        setAdmin(profile);
        if (profile) {
          trackEvent({
            evento: "admin_login",
            empresa_id: profile.empresa_id,
            resultado: "ok",
          });
        }
      })
      .catch((err) => {
        console.error("[Auth] loadAdminInBackground error:", err);
        setAdmin(null);
      })
      .finally(() => {
        setAdminLoading(false);
      });
  };

  // ── Step 1: Lazy-load Supabase client ──
  useEffect(() => {
    let cancelled = false;
    console.log("[Auth] Step 1: Loading Supabase client...");
    import("./supabase")
      .then(({ loadClient }) => {
        return loadClient().then((client: any) => {
          if (cancelled) return;
          console.log("[Auth] Step 1: Supabase client loaded");
          supabaseRef.current = client;
          initAuth(client);
        });
      })
      .catch((err) => {
        console.error("[Auth] Step 1: Failed to load Supabase client:", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 2: Initialize auth (get existing session + subscribe) ──
  const initAuth = (client: any) => {
    console.log("[Auth] Step 2: Checking existing session via getSession()...");

    client.auth
      .getSession()
      .then(({ data, error: sessionError }: any) => {
        if (sessionError) {
          console.warn("[Auth] Step 2: Session recovery failed:", sessionError.message);
          try {
            client.auth.signOut({ scope: "local" });
          } catch { /* ignore */ }
          setSession(null);
          setAdmin(null);
          setLoading(false);
          return;
        }

        const s = data?.session;
        console.log("[Auth] Step 2: getSession result:", s ? `user=${s.user?.id}` : "no session");
        setSession(s ?? null);
        // CRITICAL: set loading=false FIRST, then fetch profile in background
        setLoading(false);
        if (s?.user?.id) {
          loadAdminInBackground(client, s);
        }
      })
      .catch((err: any) => {
        console.error("[Auth] Step 2: getSession exception:", err);
        try {
          client.auth.signOut({ scope: "local" });
        } catch { /* ignore */ }
        setSession(null);
        setAdmin(null);
        setLoading(false);
      });

    // Subscribe to future auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event: any, s: any) => {
      console.log("[Auth] onAuthStateChange:", event, s ? `user=${s.user?.id}` : "no session");

      if (event === "TOKEN_REFRESHED" && !s) {
        console.warn("[Auth] Token refresh failed, clearing session");
        setSession(null);
        setAdmin(null);
        return;
      }

      setSession(s ?? null);
      if (s?.user?.id) {
        loadAdminInBackground(client, s);
      } else {
        setAdmin(null);
        setAdminLoading(false);
      }
    });

    // Store cleanup
    (window as any).__panahon_auth_unsub = () => subscription.unsubscribe();
  };

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      (window as any).__panahon_auth_unsub?.();
    };
  }, []);

  // ── signIn ──
  const signIn = async (email: string, password: string) => {
    const client = supabaseRef.current;
    if (!client) {
      console.warn("[Auth] signIn: client not ready");
      return { error: "El inicio de sesión todavía no está listo. Recargá la página e intentá nuevamente." };
    }

    try {
      console.log("[Auth] signIn: attempting for", email);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("[Auth] signIn: auth error:", error.message);
        trackEvent({
          evento: "admin_login",
          resultado: "error",
          error_mensaje: error.message,
        });
        return { error: getFriendlyError(error, "No pudimos iniciar sesión. Revisá tus datos e intentá nuevamente.") };
      }

      console.log("[Auth] signIn: token received, user:", data.session?.user?.id);

      // Set session IMMEDIATELY so useEffect in LoginPage can redirect
      setSession(data.session);
      console.log("[Auth] signIn: session state updated, redirect should trigger");

      // Fetch admin profile in background - DO NOT AWAIT
      if (data.session?.user?.id) {
        console.log("[Auth] signIn: starting background profile fetch");
        loadAdminInBackground(client, data.session);
      }

      return { error: null };
    } catch (err: any) {
      console.error("[Auth] signIn: unexpected error:", err);
      return { error: getFriendlyError(err, "No pudimos iniciar sesión. Revisá tu conexión e intentá nuevamente.") };
    }
  };

  // ── signUp ──
  const signUp = async (
    email: string,
    password: string,
    metadata: {
      nombre_completo: string;
      empresa_nombre: string;
      rubro: string;
      cantidad_empleados: string;
      valor_hora_defecto: number;
    }
  ) => {
    const client = supabaseRef.current;
    if (!client) return { error: "Cliente no disponible. Recargá la página." };

    try {
      // Step 1: Create auth user via public client — triggers confirmation email automatically.
      console.log("[Auth] signUp: creating auth user for", email);
      const { data: signUpData, error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: { data: { name: metadata.nombre_completo } },
      });

      if (signUpError) {
        console.error("[Auth] signUp: auth.signUp error:", signUpError.message);
        const msg = getFriendlyError(signUpError, "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.");
        trackEvent({
          evento: "admin_signup",
          resultado: "error",
          error_mensaje: signUpError.message,
          metadata: { step: "auth_signup" },
        });
        return { error: msg };
      }

      const user = signUpData?.user;
      if (!user?.id) return { error: "No se pudo crear el usuario. Intentá de nuevo." };

      console.log("[Auth] signUp: user created, id=", user.id, "— setting up empresa");

      // Step 2: Create empresa + perfiles_admin via server (requires service_role).
      const res = await fetch(`${SERVER_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          userId: user.id,
          email,
          name: metadata.nombre_completo,
          companyName: metadata.empresa_nombre,
          rubro: metadata.rubro,
          valorHoraDefault: metadata.valor_hora_defecto,
        }),
      });

      const serverData = await res.json();
      if (!res.ok || serverData.error) {
        console.error("[Auth] signUp: server setup error:", serverData.error);
        trackEvent({
          evento: "admin_signup",
          resultado: "error",
          error_mensaje: serverData.error || "Error al configurar la empresa",
          metadata: { step: "server_setup" },
        });
        return { error: getFriendlyError(serverData, "No pudimos configurar la empresa. Revisá tu conexión e intentá nuevamente.") };
      }

      console.log("[Auth] signUp: complete");
      trackEvent({
        evento: "admin_signup",
        resultado: "ok",
        metadata: {
          company_name: metadata.empresa_nombre,
          rubro: metadata.rubro,
        },
      });

      // If Supabase returned a session (email confirmation disabled), log in immediately.
      if (signUpData.session?.access_token && signUpData.session?.refresh_token) {
        try {
          await client.auth.setSession({
            access_token: signUpData.session.access_token,
            refresh_token: signUpData.session.refresh_token,
          });
          setSession(signUpData.session);
          loadAdminInBackground(client, signUpData.session);
        } catch (sessionErr: any) {
          console.error("[Auth] signUp: setSession failed (non-fatal):", sessionErr.message);
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error("[Auth] signUp: unexpected error:", err);
      return { error: getFriendlyError(err, "No pudimos completar el registro. Revisá tu conexión e intentá nuevamente.") };
    }
  };

  // ── signOut ──
  const signOut = async () => {
    const client = supabaseRef.current;
    if (client) {
      console.log("[Auth] signOut: signing out");
      try {
        await client.auth.signOut();
      } catch (err: any) {
        console.error("[Auth] signOut error:", err);
      }
    }
    setSession(null);
    setAdmin(null);
    setAdminLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, admin, loading, adminLoading, signIn, signUp, signOut }}>
      {children}
      {session && isWarningVisible && (
        <IdleWarningModal
          isOpen={isWarningVisible}
          remainingSeconds={remainingSeconds}
          onContinue={continueSession}
          onLogout={idleLogout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}