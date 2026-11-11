import { useRef, useState } from 'react';
import { loadClient } from './supabase';

export function useCheckout(empresaId: string | undefined, allowed: boolean) {
  const lock = useRef(false);
  const currentCompany = useRef(empresaId);
  currentCompany.current = empresaId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function openCheckout() {
    if (!allowed || !empresaId || lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try {
      const client = await loadClient();
      const { data, error: failure } = await client.functions.invoke('mp-crear-suscripcion', {
        body:{empresa_id:empresaId,plan:'base'},
      });
      if (currentCompany.current !== empresaId) return;
      if (failure) {
        let message = 'No pudimos iniciar la suscripción. Contactá al soporte de Panahon.';
        try { const details = await failure.context?.json(); if (typeof details?.error === 'string') message = details.error; } catch { /* mensaje general */ }
        throw new Error(message);
      }
      if (!data?.success || typeof data.init_point !== 'string' || typeof data.subscription_id !== 'string') throw new Error('Respuesta de suscripción inválida. Contactá al soporte.');
      const url = new URL(data.init_point);
      if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar' || url.port || url.username || url.password ||
          url.pathname !== '/subscriptions/checkout' || url.searchParams.get('preapproval_id') !== data.subscription_id ||
          url.searchParams.has('preapproval_plan_id')) throw new Error('No pudimos validar el enlace de pago. Contactá al soporte.');
      window.location.assign(url.href);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos iniciar la suscripción.');
    } finally { lock.current = false; setBusy(false); }
  }
  return {openCheckout,busy,error};
}
