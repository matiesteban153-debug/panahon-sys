/**
 * Mercado Pago configuration — producción
 */

export const MP_PUBLIC_KEY: string =
  import.meta.env.VITE_MP_PUBLIC_KEY || "APP_USR-84dddf27-0dad-41d7-abea-1df5830f50d1";

export const MP_PREAPPROVAL_PLAN_ID: string =
  import.meta.env.VITE_MP_PREAPPROVAL_PLAN_ID || "35a2edd6ac664f53b80dba813d50fef5";

// El checkout se obtiene exclusivamente del servidor para una suscripcion individual.

/**
 * Loads the Mercado Pago JS SDK v2 and initializes it with the public key.
 * Returns the MercadoPago instance. Idempotent — safe to call multiple times.
 */
let _mpInstance: any = null;

export function getMercadoPago(): Promise<any> {
  if (_mpInstance) return Promise.resolve(_mpInstance);

  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) {
      _mpInstance = new (window as any).MercadoPago(MP_PUBLIC_KEY, { locale: "es-AR" });
      resolve(_mpInstance);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => {
      _mpInstance = new (window as any).MercadoPago(MP_PUBLIC_KEY, { locale: "es-AR" });
      resolve(_mpInstance);
    };
    script.onerror = () => reject(new Error("Failed to load MercadoPago SDK"));
    document.head.appendChild(script);
  });
}
