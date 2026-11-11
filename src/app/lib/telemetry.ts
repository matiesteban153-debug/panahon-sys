import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const SERVER_EVENTOS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-bdf30ab0/eventos`;

export interface TrackEventParams {
  evento: string;
  empresa_id?: string | null;
  empleado_id?: string | null;
  registro_id?: string | null;
  resultado?: string | null;
  error_codigo?: string | null;
  error_mensaje?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget telemetry helper.
 * Posts to the server endpoint (service_role) to bypass RLS on the eventos table.
 * Never throws — errors go to console only.
 */
export function trackEvent(params: TrackEventParams): void {
  console.log(`[Pulse] trackEvent called — evento="${params.evento}"`);

  fetch(SERVER_EVENTOS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({
      evento:        params.evento,
      empresa_id:    params.empresa_id    ?? null,
      empleado_id:   params.empleado_id   ?? null,
      registro_id:   params.registro_id   ?? null,
      resultado:     params.resultado     ?? null,
      error_codigo:  params.error_codigo  ?? null,
      error_mensaje: params.error_mensaje ?? null,
      metadata:      params.metadata      ?? null,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        res.text().then((body) =>
          console.error(`[Pulse] Server error — evento="${params.evento}" status=${res.status}: ${body}`)
        );
      } else {
        console.log(`[Pulse] INSERT OK — evento="${params.evento}"`);
      }
    })
    .catch((err: unknown) => {
      console.error(`[Pulse] Fetch error — evento="${params.evento}":`, err);
    });
}
