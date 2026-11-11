import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./lib/theme-context";
import { PostHogProvider } from "@posthog/react";
import { getMercadoPago } from "./lib/mercadopago";

// Pre-load MP SDK in the background so it's ready when the user reaches checkout
getMercadoPago().catch(() => {
  // Non-fatal — checkout redirect still works without the SDK
});

const SENTRY_DSN: string =
  import.meta.env.VITE_SENTRY_DSN ??
  "https://66580d47691db2468d70e4e7d1c94b13@o4511735325851648.ingest.us.sentry.io/4511735337648128";

if (!Sentry.isInitialized()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const POSTHOG_KEY: string =
  import.meta.env.VITE_POSTHOG_KEY ?? "phc_A23DBA6CKY6eG9hmfC5quZQHqAQfsynR5ssT66GHJJeS";
const POSTHOG_HOST = "https://us.i.posthog.com";


function FallbackUI() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        background: "#F4F5F7",
        gap: 12,
      }}
    >
      <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1A1A1A" }}>
        Algo salió mal.
      </p>
      <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>
        El error fue reportado automáticamente. Por favor recargá la página.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          padding: "10px 20px",
          background: "#F97316",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Recargar
      </button>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (document.getElementById('google-analytics')) return;

    const script1 = document.createElement('script');
    script1.id = 'google-analytics';
    script1.async = true;
    const gaId = import.meta.env.VITE_GA_ID ?? 'G-747PKSER1M';
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}');
    `;
    document.head.appendChild(script2);
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={<FallbackUI />}>
      <PostHogProvider
        apiKey={POSTHOG_KEY}
        options={{ api_host: POSTHOG_HOST }}
      >
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  );
}
