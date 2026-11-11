import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13.2.2";
import { isoBase64URL } from "npm:@simplewebauthn/server@13.2.2/helpers";

export function registerWebAuthnRoutes(app: Hono, resolveEmpresa: any, validateEmpleado: any, resolveAdmin: any) {
  app.post("/make-server-bdf30ab0/webauthn/:operation", async (context) => {
    try {
      const origin = Deno.env.get("WEBAUTHN_ORIGIN");
      const rpID = Deno.env.get("WEBAUTHN_RP_ID");
      if (!origin || !rpID) return context.json({ error: "La biometría todavía no está configurada. Usá el fichaje habitual." }, 503);
      if (context.req.header("Origin") !== origin) return context.json({ error: "Origen no autorizado para WebAuthn" }, 403);
      const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body = await context.req.json();
      const operation = context.req.param("operation");
      if (!["register-options", "register-verify", "authenticate-options", "authenticate-verify"].includes(operation)) return context.json({ error: "Operación inválida" }, 400);
      if (typeof body.empleadoId !== "string" || typeof body.qrToken !== "string") return context.json({ error: "Faltan datos del empleado" }, 400);
      const empresa = await resolveEmpresa(client, body.qrToken);
      if (!empresa.ok) return context.json({ error: empresa.error, code: empresa.codigo, codigo: empresa.codigo }, empresa.status);
      const empleado = await validateEmpleado(client, body.empleadoId, empresa.empresaId);
      if (!empleado.ok) return context.json({ error: empleado.error }, empleado.status);
      try {
        let { data: subData, error: subErr } = await client.rpc("verificar_estado_empresa_empleado", { p_empleado_id: body.empleadoId });
        if (subErr && (subErr.code === "PGRST202" || subErr.message?.includes("p_empleado_id"))) {
          const retry = await client.rpc("verificar_estado_empresa_empleado", { empleado_id: body.empleadoId });
          subData = retry.data;
          subErr = retry.error;
        }
        const row = Array.isArray(subData) ? subData[0] : subData;
        if (!subErr && row && typeof row === "object" && row.valido === false) {
          return context.json({
            error: row.mensaje ?? row.message ?? "El período de prueba o suscripción de la empresa ha finalizado. Por favor, comunícate con tu administrador para renovar el plan.",
            code: row.codigo ?? row.code ?? "PLAN_VENCIDO",
            codigo: row.codigo ?? row.code ?? "PLAN_VENCIDO",
          }, 403);
        }
      } catch {
        // Fallback already covered by resolveEmpresa
      }
      let adminId: string | null = null;
      if (operation.startsWith("register")) {
        const admin = await resolveAdmin(client, context.req.header("Authorization") ?? null);
        if (!admin.ok || admin.empresaId !== empresa.empresaId) return context.json({ error: "La primera vinculación requiere una sesión autorizada del administrador de tu empresa en este celular." }, 403);
        adminId = admin.userId;
      }
      if (operation === "register-options") {
        const { data: employeeData, error: employeeError } = await client.from("empleados").select("nombre_completo").eq("id", body.empleadoId).single();
        if (employeeError) throw employeeError;
        const { data: existing, error } = await client.from("employee_webauthn_credentials").select("credential_id").eq("empleado_id", body.empleadoId);
        if (error) throw error;
        const options = await generateRegistrationOptions({
          rpName: "Panahon", rpID, userID: new TextEncoder().encode(body.empleadoId), userName: body.empleadoId,
          userDisplayName: employeeData.nombre_completo, attestationType: "none",
          authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "discouraged", userVerification: "required" },
          excludeCredentials: existing.map((item) => ({ id: item.credential_id })), timeout: 60000,
        });
        const { data: challenge, error: challengeError } = await client.from("employee_webauthn_challenges").insert({ empleado_id: body.empleadoId, challenge: options.challenge, operation: "register", admin_id: adminId }).select("id").single();
        if (challengeError) throw challengeError;
        return context.json({ options, challengeId: challenge.id });
      }
      if (operation === "authenticate-options") {
        if (typeof body.credentialId !== "string") return context.json({ error: "Vinculá este celular desde Mis datos.", code: "unlinked" }, 403);
        const { data: credential, error } = await client.from("employee_webauthn_credentials").select("credential_id").eq("empleado_id", body.empleadoId).eq("credential_id", body.credentialId).maybeSingle();
        if (error) throw error;
        if (!credential) return context.json({ error: "Vinculá tu huella o Face ID por primera vez desde los ajustes de tu perfil", code: "unlinked" }, 403);
        const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: [{ id: credential.credential_id, transports: ["internal"] }], timeout: 60000 });
        const { data: challenge, error: challengeError } = await client.from("employee_webauthn_challenges").insert({ empleado_id: body.empleadoId, credential_id: credential.credential_id, challenge: options.challenge, operation: "authenticate" }).select("id").single();
        if (challengeError) throw challengeError;
        return context.json({ options, challengeId: challenge.id });
      }
      if (typeof body.challengeId !== "string" || !body.response) return context.json({ error: "Falta la respuesta WebAuthn" }, 400);
      const { data: challenge, error: challengeError } = await client.from("employee_webauthn_challenges").delete().eq("id", body.challengeId).eq("empleado_id", body.empleadoId).eq("operation", operation === "register-verify" ? "register" : "authenticate").gt("expires_at", new Date().toISOString()).select().maybeSingle();
      if (challengeError) throw challengeError;
      if (!challenge || (operation === "register-verify" && challenge.admin_id !== adminId)) return context.json({ error: "La solicitud expiró o ya fue utilizada. Volvé a intentar." }, 403);
      if (operation === "register-verify") {
        const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
        if (!result.verified || !result.registrationInfo) return context.json({ error: "No se pudo verificar la credencial" }, 403);
        const info = result.registrationInfo;
        if (info.credentialDeviceType !== "singleDevice" || info.credentialBackedUp) return context.json({ error: "Este dispositivo ofrece una clave sincronizada. Para limitar el fichaje a este celular se requiere una credencial no sincronizable. Podés usar el fichaje habitual." }, 403);
        const { error } = await client.from("employee_webauthn_credentials").insert({ empleado_id: body.empleadoId, credential_id: info.credential.id, public_key: isoBase64URL.fromBuffer(info.credential.publicKey), counter: info.credential.counter, transports: info.credential.transports ?? [] });
        if (error) throw error;
        return context.json({ verified: true, credentialId: info.credential.id });
      }
      if (body.response.id !== challenge.credential_id) return context.json({ error: "La credencial no corresponde a este celular" }, 403);
      const { data: credential, error } = await client.from("employee_webauthn_credentials").select().eq("credential_id", challenge.credential_id).eq("empleado_id", body.empleadoId).single();
      if (error) throw error;
      const result = await verifyAuthenticationResponse({ response: body.response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: { id: credential.credential_id, publicKey: isoBase64URL.toBuffer(credential.public_key), counter: Number(credential.counter), transports: credential.transports } });
      if (!result.verified || result.authenticationInfo.credentialDeviceType !== "singleDevice" || result.authenticationInfo.credentialBackedUp) return context.json({ error: "La verificación del dispositivo falló" }, 403);
      const { data: updated, error: updateError } = await client.from("employee_webauthn_credentials").update({ counter: result.authenticationInfo.newCounter }).eq("credential_id", credential.credential_id).eq("counter", credential.counter).select("credential_id").maybeSingle();
      if (updateError || !updated) return context.json({ error: "La credencial cambió. Volvé a verificar." }, 403);
      const { data: proof, error: proofError } = await client.from("employee_webauthn_proofs").insert({ empleado_id: body.empleadoId }).select("id").single();
      if (proofError) throw proofError;
      return context.json({ verified: true, proof: proof.id });
    } catch {
      return context.json({ error: "No pudimos validar WebAuthn. Revisá tu conexión y volvé a intentar; el fichaje habitual sigue disponible." }, 400);
    }
  });
}

export async function consumeWebAuthnProof(client: any, empleadoId: string, proof: unknown): Promise<boolean> {
  if (!proof || typeof proof !== "string") return true;
  try {
    const { data, error } = await client
      .from("employee_webauthn_proofs")
      .delete()
      .eq("id", proof)
      .eq("empleado_id", empleadoId)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn(`[WebAuthn] No se pudo verificar proof (módulo o tabla no disponible): ${error.message}`);
      return true;
    }
    return Boolean(data);
  } catch (err: any) {
    console.warn(`[WebAuthn] Error inesperado verificando proof, permitiendo fichaje: ${err?.message ?? err}`);
    return true;
  }
}
