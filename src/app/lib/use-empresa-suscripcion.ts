import { useEffect, useState } from "react"
import { loadClient } from "./supabase"

export interface EmpresaSuscripcion {
  exento_pago: boolean
  fecha_vencimiento: string | null
  plan_activo: boolean
  plan_estado: string | null
  mp_preapproval_id: string | null
  mp_subscription_id: string | null
  deleted_at: string | null
  created_at: string
  nombre: string
  email_contacto: string
}

export const LINKED_SUBSCRIPTION_MESSAGE =
  "Ya tenés una suscripción vinculada. Si pagaste y no podés ingresar, contactá al soporte de Panahon."

export function hasLinkedSubscription(empresa: EmpresaSuscripcion): boolean {
  return Boolean(
    empresa.mp_preapproval_id ||
      empresa.mp_subscription_id ||
      empresa.plan_estado === "activo",
  )
}

interface LoadResult {
  empresaId: string | undefined
  attempt: number
  empresa: EmpresaSuscripcion | null
  fetchError: boolean
}

/** Read-only UI containment; this does not reconcile with Mercado Pago. */
export function useEmpresaSuscripcion(empresaId: string | undefined) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function readEmpresa() {
      try {
        if (!empresaId) throw new Error("Empresa no disponible")
        const client = await loadClient()
        const { data, error } = await client
          .from("empresas")
          .select(
            "exento_pago, fecha_vencimiento, plan_activo, plan_estado, mp_preapproval_id, mp_subscription_id, deleted_at, created_at, nombre, email_contacto",
          )
          .eq("id", empresaId)
          .single()

        // Missing subscription fields must not be interpreted as no subscription.
        if (
          error ||
          !data ||
          [
            "exento_pago",
            "fecha_vencimiento",
            "mp_preapproval_id",
            "mp_subscription_id",
            "plan_estado",
            "deleted_at",
          ].some((field) => data[field] === undefined)
        ) {
          throw new Error("No se pudo comprobar la suscripción")
        }
        if (!cancelled) {
          setResult({
            empresaId,
            attempt,
            empresa: data as EmpresaSuscripcion,
            fetchError: false,
          })
        }
      } catch {
        if (!cancelled) {
          setResult({ empresaId, attempt, empresa: null, fetchError: true })
        }
      }
    }

    void readEmpresa()
    return () => {
      cancelled = true
    }
  }, [empresaId, attempt])

  // Invalidate previous data immediately on retry or company change, before effects run.
  const current =
    result?.empresaId === empresaId && result?.attempt === attempt
      ? result
      : null
  const empresa = current?.empresa ?? null
  const fetchError = current?.fetchError ?? false
  const isLoading = current === null
  const linked = empresa ? hasLinkedSubscription(empresa) : false
  const canCheckout = Boolean(
    empresa &&
      !isLoading &&
      !fetchError &&
      empresa.deleted_at === null &&
      !linked &&
      empresa.exento_pago === false,
  )

  const canResumeCheckout = Boolean(empresa && !isLoading && !fetchError &&
    empresa.deleted_at === null && empresa.exento_pago === false && empresa.plan_estado === "pendiente" &&
    (empresa.mp_preapproval_id || empresa.mp_subscription_id) &&
    (!empresa.mp_preapproval_id || !empresa.mp_subscription_id || empresa.mp_preapproval_id === empresa.mp_subscription_id));

  return {
    canResumeCheckout,
    empresa,
    isLoading,
    fetchError,
    hasLinkedSubscription: linked,
    canCheckout,
    reload: () => setAttempt((previous) => previous + 1),
  }
}
