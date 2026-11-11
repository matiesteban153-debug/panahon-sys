/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Declaración para display-mode media queries
interface MediaQueryList {
  readonly matches: boolean
  readonly media: string
  addEventListener(type: 'change', listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any, options?: boolean | AddEventListenerOptions): void
  removeEventListener(type: 'change', listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any, options?: boolean | EventListenerOptions): void
}

declare global {
  interface Navigator {
    // Para detectar modo standalone en iOS
    standalone?: boolean
  }
}

export {}
