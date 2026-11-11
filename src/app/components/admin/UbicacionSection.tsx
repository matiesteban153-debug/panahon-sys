import { useState } from "react";
import {
  MapPin,
  Navigation,
  Loader2,
  Check,
  ShieldCheck,
  ShieldOff,
  Info,
  AlertCircle,
  Link2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { updateEmpresa } from "../../lib/api";

interface UbicacionSectionProps {
  empresaId: string;
  initialLat: number | null;
  initialLng: number | null;
  initialRadio: number | null;
}

type GpsStatus    = "idle" | "loading" | "denied" | "unavailable";
type SaveStatus   = "idle" | "saving" | "saved" | "error";
type MapsUrlState = "empty" | "valid" | "invalid" | "short";

// ─── Google Maps URL parser ────────────────────────────────────────────────────
/**
 * Tries to extract {lat, lng} from any Google Maps URL.
 * Handles the two most common patterns:
 *   1. @lat,lng        — share / embed URLs: maps/place/…/@-34.6037,-58.3816,15z
 *   2. !3dlat!4dlng   — "data" URLs:       …/data=!4m5!3m4!…!3d-34.6037!4d-58.3816
 *   3. ll=lat,lng      — older /maps?ll= URLs
 *   4. q=lat,lng       — plain coordinate search URLs
 */
function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const isValid = (lat: number, lng: number) =>
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90  && lat <= 90   &&
    lng >= -180 && lng <= 180;

  let decodedUrl = url.trim().replace(/\+/g, " ");
  try {
    decodedUrl = decodeURIComponent(decodedUrl);
  } catch {
    // A malformed percent escape should simply be treated as an unparseable URL.
    return null;
  }

  // 1. @lat,lng[,zoom]  — most common in shared links
  const atMatch = decodedUrl.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // 2. !3dlat!4dlng  — "data" deep-links (place detail pages)
  const dataMatch = decodedUrl.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // 3. ll=lat,lng  — legacy ?ll= param
  const llMatch = decodedUrl.match(/[?&]ll=(-?\d{1,3}\.?\d*),(-?\d{1,3}\.?\d*)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // 4. q=lat,lng  — coordinate-only search
  const qMatch = decodedUrl.match(/[?&](?:q|query|destination)=(-?\d{1,3}\.?\d*),(-?\d{1,3}\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // 5. Search and directions URLs often encode coordinates directly in the path.
  const coordinateMatch = decodedUrl.match(/(?:search|place|dir)\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (coordinateMatch) {
    const lat = parseFloat(coordinateMatch[1]);
    const lng = parseFloat(coordinateMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MIN_RADIO = 200;
const MAX_RADIO_ADVERTENCIA = 500;

export function UbicacionSection({
  empresaId,
  initialLat,
  initialLng,
  initialRadio,
}: UbicacionSectionProps) {
  const [lat, setLat]     = useState<number | null>(initialLat);
  const [lng, setLng]     = useState<number | null>(initialLng);
  const [radio, setRadio] = useState<number>(Math.max(MIN_RADIO, initialRadio ?? MIN_RADIO));

  const [gpsStatus, setGpsStatus]   = useState<GpsStatus>("idle");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError]   = useState<string | null>(null);

  // Maps URL alternative
  const [mapsUrl, setMapsUrl]         = useState("");
  const [mapsUrlState, setMapsUrlState] = useState<MapsUrlState>("empty");

  const geovallaActiva = lat != null && lng != null;
  const coordsCaptured =
    lat != null && lng != null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    radio >= MIN_RADIO;
  const isBusy         = gpsStatus === "loading" || saveStatus === "saving";

  // ── GPS capture ──────────────────────────────────────────────────────────
  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    setGpsStatus("loading");
    setGpsAccuracy(null);
    setSaveStatus("idle");
    // Clear the maps URL field when using GPS so both methods don't confuse state
    setMapsUrl("");
    setMapsUrlState("empty");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus("idle");
      },
      (err) => setGpsStatus(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ── Google Maps URL handler ──────────────────────────────────────────────
  const handleMapsUrlChange = (value: string) => {
    setMapsUrl(value);
    setSaveStatus("idle");

    if (!value.trim()) {
      setMapsUrlState("empty");
      return;
    }

    const coords = parseGoogleMapsUrl(value);
    if (coords) {
      setLat(coords.lat);
      setLng(coords.lng);
      setMapsUrlState("valid");
      // Clear any previous GPS error since we now have coords from the URL
      setGpsStatus("idle");
    } else {
      setMapsUrlState(/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(value) ? "short" : "invalid");
    }
  };

  // ── Save to DB ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!empresaId || lat == null || lng == null) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await updateEmpresa(empresaId, {
        latitud:      lat,
        longitud:     lng,
        radio_metros: Math.max(MIN_RADIO, Math.round(radio)),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err: any) {
      console.error("[Ubicacion] Error saving:", err);
      setSaveError("No se pudo guardar. Intentá de nuevo.");
      setSaveStatus("error");
    }
  };

  // ── Clear geofence ───────────────────────────────────────────────────────
  const handleClear = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await updateEmpresa(empresaId, { latitud: null, longitud: null, radio_metros: null });
      setLat(null);
      setLng(null);
      setRadio(MIN_RADIO);
      setMapsUrl("");
      setMapsUrlState("empty");
      setSaveStatus("idle");
    } catch (err: any) {
      setSaveError("No se pudo desactivar la geovalla.");
      setSaveStatus("error");
    }
  };

  function formatCoord(value: number | null, placeholder: string) {
    if (value == null) return placeholder;
    return value.toFixed(6);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <h2 className="text-[#1A1A1A]" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>
          Ubicación del Local
        </h2>
        {geovallaActiva ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex-shrink-0" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
            Geovalla activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[#1A1A1A]/40 flex-shrink-0" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
            <ShieldOff className="w-3.5 h-3.5" strokeWidth={1.5} />
            Sin configurar
          </span>
        )}
      </div>

      {/* ── Enlace de Google Maps (principal) ── */}
      <div className="mb-5 rounded-xl border border-[#F97316]/25 bg-[#F97316]/[0.04] p-4">
        <label htmlFor="maps-link" className="block text-[#1A1A1A] mb-1.5" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
          Enlace de Google Maps del local
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              {mapsUrlState === "valid" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2} />
              ) : (
                <Link2 className="w-4 h-4 text-[#1A1A1A]/30" strokeWidth={1.5} />
              )}
            </div>
            <input
              id="maps-link"
              type="url"
              value={mapsUrl}
              onChange={(e) => handleMapsUrlChange(e.target.value)}
              disabled={isBusy}
              placeholder="Ej: https://maps.app.goo.gl/..."
              className={`w-full pl-10 pr-4 py-3 rounded-lg border text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 transition-colors bg-white disabled:opacity-50 ${
                mapsUrlState === "valid"
                  ? "border-emerald-300 focus:ring-emerald-200 focus:border-emerald-400"
                  : mapsUrlState === "invalid" || mapsUrlState === "short"
                  ? "border-amber-300 focus:ring-amber-200 focus:border-amber-400"
                  : "border-gray-200 focus:ring-[#F97316]/30 focus:border-[#F97316]"
              }`}
              style={{ fontSize: "0.9375rem" }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleMapsUrlChange(mapsUrl)}
            disabled={isBusy || !mapsUrl.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            <MapPin className="w-4 h-4" strokeWidth={2} />
            Detectar ubicación
          </button>
        </div>

        {mapsUrlState === "valid" && (
          <p className="mt-2 text-emerald-700 flex items-center gap-1.5" style={{ fontSize: "0.8125rem", fontWeight: 600 }} role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            ¡Ubicación detectada correctamente!
          </p>
        )}
        {mapsUrlState === "short" && (
          <p className="mt-2 text-amber-700" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
            Los enlaces cortos no incluyen coordenadas. Abrilo en el navegador y pegá la URL larga que aparece en la barra de direcciones.
          </p>
        )}
        {mapsUrlState === "invalid" && (
          <p className="mt-2 text-amber-700" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
            No pudimos encontrar coordenadas en ese enlace. Pegá la URL completa de Google Maps de tu local.
          </p>
        )}
        {mapsUrlState === "empty" && (
          <p className="mt-2 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem" }}>
            Abrí Google Maps, buscá tu local, copiá el enlace y pegalo acá.
          </p>
        )}

        {/* Alternativa: GPS del dispositivo */}
        <div className="mt-3 border-t border-[#F97316]/15 pt-3">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isBusy}
            className="inline-flex items-center gap-2 text-[#F97316] hover:text-[#EA6C0A] transition-colors disabled:opacity-50"
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            {gpsStatus === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Detectando ubicación…</>
            ) : (
              <><Navigation className="w-4 h-4" strokeWidth={2} />O usar mi ubicación actual (estando en el local)</>
            )}
          </button>
          {gpsAccuracy != null && gpsStatus === "idle" && (
            <p className="mt-2 flex items-center gap-1.5 text-emerald-700" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              ¡Ubicación detectada correctamente! · Precisión: ±{gpsAccuracy} m
            </p>
          )}
          {gpsStatus === "denied" && (
            <div className="mt-2 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-red-700" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
                Permiso denegado. Activá el GPS en la configuración de tu celular y volvé a intentarlo.
              </p>
            </div>
          )}
          {gpsStatus === "unavailable" && (
            <div className="mt-2 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-amber-700" style={{ fontSize: "0.8125rem" }}>
                No se pudo obtener la ubicación. Verificá que el GPS esté habilitado.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Radio ── */}
      <div className="mb-5">
        <label htmlFor="radio-geovalla" className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
          Radio de la geovalla (metros)
        </label>
        <div className="relative max-w-[200px]">
          <input
            id="radio-geovalla"
            type="number" min={MIN_RADIO} max={5000} step={10} inputMode="numeric"
            value={radio}
            onChange={(e) => setRadio(Number(e.target.value))}
            onBlur={() => setRadio((r) => Math.max(MIN_RADIO, Math.round(r) || MIN_RADIO))}
            aria-invalid={radio < MIN_RADIO}
            aria-describedby="radio-ayuda"
            disabled={isBusy}
            className={`w-full pr-12 pl-3.5 py-2.5 rounded-lg border text-[#1A1A1A] focus:outline-none focus:ring-2 bg-white disabled:opacity-50 ${radio < MIN_RADIO ? "border-amber-400 focus:ring-amber-300/40 focus:border-amber-500" : "border-gray-200 focus:ring-[#F97316]/30 focus:border-[#F97316]"}`}
            style={{ fontSize: "0.9375rem" }}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/35 pointer-events-none" style={{ fontSize: "0.8125rem" }}>
            metros
          </span>
        </div>
        <p id="radio-ayuda" className={`mt-1.5 ${radio < MIN_RADIO ? "text-amber-700" : "text-[#1A1A1A]/40"}`} style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
          Radio mínimo de 200 metros para evitar errores de GPS en interiores.
        </p>
        {radio > MAX_RADIO_ADVERTENCIA && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.75} />
            <p className="text-amber-800" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
              Un radio mayor a 500 m puede permitir fichajes fuera del local. Ajustalo al tamaño real del local.
            </p>
          </div>
        )}
      </div>

      {/* ── Ajustes avanzados ── */}
      <details className="group mb-5 rounded-lg border border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[#1A1A1A]/60 [&::-webkit-details-marker]:hidden" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
          Ajustes avanzados
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.75} />
        </summary>
        <div className="border-t border-gray-100 px-4 py-4">
          <p className="mb-3 text-[#1A1A1A]/45" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
            Solo para casos excepcionales. Normalmente se completan solos al detectar la ubicación.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lat-manual" className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Latitud</label>
              <input
                id="lat-manual" type="number" step="any" min={-90} max={90}
                value={lat ?? ""} placeholder="-34.603700" disabled={isBusy}
                onChange={(e) => { setLat(e.target.value === "" ? null : Number(e.target.value)); setSaveStatus("idle"); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white font-mono text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] disabled:opacity-50"
                style={{ fontSize: "0.875rem" }}
              />
            </div>
            <div>
              <label htmlFor="lng-manual" className="block text-[#1A1A1A]/60 mb-1.5" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Longitud</label>
              <input
                id="lng-manual" type="number" step="any" min={-180} max={180}
                value={lng ?? ""} placeholder="-58.381600" disabled={isBusy}
                onChange={(e) => { setLng(e.target.value === "" ? null : Number(e.target.value)); setSaveStatus("idle"); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white font-mono text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] disabled:opacity-50"
                style={{ fontSize: "0.875rem" }}
              />
            </div>
          </div>
        </div>
      </details>

      {/* ── Save error banner ── */}
      {saveStatus === "error" && saveError && (
        <div className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-red-700" style={{ fontSize: "0.8125rem" }}>{saveError}</p>
        </div>
      )}

      {/* ── Save / Clear buttons ── */}
      <div className="flex flex-wrap gap-2.5 mb-5">
        <button
          onClick={handleSave}
          disabled={isBusy || !coordsCaptured}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] text-white hover:bg-[#EA6C0A] active:bg-[#DC6A0A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {saveStatus === "saving" ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
          ) : saveStatus === "saved" ? (
            <><Check className="w-4 h-4" />Guardado</>
          ) : (
            <><MapPin className="w-4 h-4" />Guardar Ubicación</>
          )}
        </button>

        {geovallaActiva && saveStatus !== "saving" && (
          <button
            onClick={handleClear}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-[#1A1A1A]/50 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            <ShieldOff className="w-4 h-4" strokeWidth={1.5} />
            Desactivar geovalla
          </button>
        )}
      </div>

      {/* ── Info note ── */}
      <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-[#F97316]/6 border border-[#F97316]/15">
        <Info className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="text-[#F97316]" style={{ fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.5 }}>
            Para mejores resultados, realizá esta configuración estando dentro del local.
          </p>
          <p className="text-[#1A1A1A]/45 mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
            Una vez guardados los valores de latitud y longitud, el sistema de fichaje por GPS quedará activo automáticamente para todos tus empleados.
          </p>
        </div>
      </div>

    </section>
  );
}
