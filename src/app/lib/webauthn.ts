import { loadClient } from "./supabase";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const endpoint = `https://${projectId}.supabase.co/functions/v1/make-server-bdf30ab0/webauthn`;

export class WebAuthnError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function encode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (character) => character.charCodeAt(0)).buffer;
}

function keyFor(employeeId: string) {
  return `panahon:webauthn:${window.location.hostname}:${employeeId}`;
}

function assertSupported() {
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials?.create || !navigator.credentials?.get) throw new WebAuthnError("Este navegador no permite usar biometría. Podés fichar con el botón habitual y GPS, sin instalar la aplicación.");
}

async function requestCredential(operation: () => Promise<Credential | null>): Promise<PublicKeyCredential> {
  try {
    const credential = await operation();
    if (!credential) throw new WebAuthnError("La biometría fue cancelada o no está configurada. No se registró asistencia.");
    return credential as PublicKeyCredential;
  } catch (error) {
    throw new WebAuthnError(webAuthnErrorMessage(error), "unavailable");
  }
}

async function request(operation: string, body: Record<string, unknown>, signal: AbortSignal) {
  let token = publicAnonKey;
  try {
    const client = await loadClient();
    const { data } = await client.auth.getSession();
    if (data?.session?.access_token) {
      token = data.session.access_token;
    }
  } catch {
    // Fallback to publicAnonKey if session check fails
  }
  let response: Response;
  try {
    response = await fetch(`${endpoint}/${operation}`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WebAuthnError("No se pudo conectar con el servidor de biometría. Podés usar el botón de fichaje habitual.", "unavailable");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new WebAuthnError(result.error || "No pudimos validar el dispositivo. Podés usar el fichaje habitual.", result.code);
  return result;
}

function serialize(credential: PublicKeyCredential) {
  const response = credential.response;
  const common = { id: credential.id, rawId: encode(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(), authenticatorAttachment: credential.authenticatorAttachment };
  if (response instanceof AuthenticatorAttestationResponse) {
    return { ...common, response: { clientDataJSON: encode(response.clientDataJSON), attestationObject: encode(response.attestationObject), transports: response.getTransports?.() ?? [] } };
  }
  const assertion = response as AuthenticatorAssertionResponse;
  return { ...common, response: { clientDataJSON: encode(assertion.clientDataJSON), authenticatorData: encode(assertion.authenticatorData), signature: encode(assertion.signature), userHandle: assertion.userHandle ? encode(assertion.userHandle) : null } };
}

export async function registerEmployeeDevice(employeeId: string, qrToken: string, signal: AbortSignal) {
  assertSupported();
  localStorage.setItem(`${keyFor(employeeId)}:storage-check`, "ok");
  localStorage.removeItem(`${keyFor(employeeId)}:storage-check`);
  const { options, challengeId } = await request("register-options", { empleadoId: employeeId, qrToken }, signal);
  const credential = await requestCredential(() => navigator.credentials.create({ signal, publicKey: {
    ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((item: { id: string; type: string }) => ({ ...item, id: decode(item.id) })),
  } }));
  if (!credential) throw new WebAuthnError("La vinculación fue cancelada.");
  const result = await request("register-verify", { empleadoId: employeeId, qrToken, challengeId, response: serialize(credential) }, signal);
  if (result.verified !== true || !result.credentialId) throw new WebAuthnError("No se confirmó la vinculación.");
  localStorage.setItem(keyFor(employeeId), result.credentialId);
}

export async function authenticateEmployeeDevice(employeeId: string, qrToken: string, signal: AbortSignal): Promise<string> {
  assertSupported();
  const credentialId = localStorage.getItem(keyFor(employeeId));
  if (!credentialId) throw new WebAuthnError("Vinculá tu huella o Face ID por primera vez desde los ajustes de tu perfil", "unlinked");
  const { options, challengeId } = await request("authenticate-options", { empleadoId: employeeId, qrToken, credentialId }, signal);
  const credential = await requestCredential(() => navigator.credentials.get({ signal, publicKey: {
    ...options, challenge: decode(options.challenge),
    allowCredentials: options.allowCredentials.map((item: { id: string; type: string }) => ({ ...item, id: decode(item.id) })),
  } }));
  if (!credential) throw new WebAuthnError("La verificación fue cancelada. No se registró asistencia.");
  const result = await request("authenticate-verify", { empleadoId: employeeId, qrToken, challengeId, response: serialize(credential) }, signal);
  if (result.verified !== true || !result.proof) throw new WebAuthnError("La verificación falló. No se registró asistencia.");
  return result.proof;
}

export function webAuthnErrorMessage(error: unknown) {
  if (error instanceof WebAuthnError) return error.message;
  if (error instanceof DOMException && ["NotAllowedError", "AbortError"].includes(error.name)) return "Verificación cancelada, vencida o no autorizada. No se registró asistencia; podés usar el fichaje habitual.";
  if (error instanceof DOMException && error.name === "InvalidStateError") return "Este autenticador ya tiene una credencial registrada. Consultá a tu administrador antes de volver a vincular.";
  return "No pudimos completar la verificación. Revisá tu conexión y la compatibilidad del dispositivo. El fichaje habitual sigue disponible.";
}
