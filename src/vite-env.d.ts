/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MP_PUBLIC_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_DEMO_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
