import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import {
  LINKED_SUBSCRIPTION_MESSAGE,
  type useEmpresaSuscripcion,
} from "../../lib/use-empresa-suscripcion"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"

export function SubscriptionNotice({
  subscription,
}: {
  subscription: ReturnType<typeof useEmpresaSuscripcion>
}) {
  const { empresa, isLoading, fetchError, hasLinkedSubscription, reload } =
    subscription

  if (isLoading) {
    return (
      <Alert role="status">
        <Loader2 className="animate-spin" />
        <AlertDescription>
          Cargando información de suscripción…
        </AlertDescription>
      </Alert>
    )
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          No se pudo cargar la información de la empresa. No podemos habilitar
          una nueva suscripción sin comprobarla.
          <Button variant="outline" size="sm" onClick={reload}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (empresa?.exento_pago && !empresa.deleted_at) {
    return <Alert><AlertDescription>Esta empresa está exenta de pago. No necesitás crear una suscripción.</AlertDescription></Alert>
  }

  if (hasLinkedSubscription || empresa?.deleted_at) {
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>
          {hasLinkedSubscription
            ? subscription.canResumeCheckout ? "Tenés una suscripción pendiente. Podés continuar el mismo trámite sin crear otra." : LINKED_SUBSCRIPTION_MESSAGE
            : "Esta empresa está eliminada. Contactá al soporte de Panahon."}
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw />
            Volver a comprobar estado
          </Button>
          Esta comprobación vuelve a leer los datos de Panahon; no consulta
          Mercado Pago.
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
