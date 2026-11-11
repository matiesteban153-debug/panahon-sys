# PROMPT – PWA: APP DE FICHAJE
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Convertir la app de fichaje de Panahon en una Progressive Web App (PWA).
El objetivo es que los empleados puedan instalarla en la pantalla de inicio
de su celular y abrirla directamente sin necesidad de escanear el QR cada vez.

**Solo aplica a la app de fichaje (`/fichaje`). El dashboard admin no cambia.**
**No modificar ninguna lógica existente — solo agregar los archivos PWA.**

---

## ARCHIVOS A CREAR

### 1. `/public/manifest.json`

```json
{
  "name": "Panahon – Fichaje",
  "short_name": "Panahon",
  "description": "Sistema de fichaje de Panahon",
  "start_url": "/fichaje",
  "scope": "/fichaje",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#F97316",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

### 2. `/public/sw.js` (Service Worker)

```js
const CACHE_NAME = 'panahon-fichaje-v1'

// Archivos a cachear para funcionamiento offline básico
const STATIC_ASSETS = [
  '/fichaje',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// Instalar service worker y cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activar y limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Estrategia: Network First para datos, Cache First para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Llamadas a Supabase: siempre desde la red, nunca cachear
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Assets estáticos: cache first, fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // Cachear solo respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
    })
  )
})

// Forzar actualización cuando hay nueva versión disponible
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
```

---

### 3. Registrar el Service Worker en el entry point de la app

En el archivo principal de React (main.tsx o index.tsx), agregar al final:

```js
// Registrar Service Worker solo en producción y solo para /fichaje
if ('serviceWorker' in navigator && window.location.pathname.startsWith('/fichaje')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registrado:', reg.scope)

        // Detectar nueva versión disponible
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Hay nueva versión — forzar actualización silenciosa
              newWorker.postMessage('SKIP_WAITING')
              window.location.reload()
            }
          })
        })
      })
      .catch(err => console.log('[PWA] Error al registrar Service Worker:', err))
  })
}
```

---

### 4. Agregar meta tags en el `<head>` del HTML

En `index.html`, agregar dentro del `<head>`:

```html
<!-- PWA -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#F97316" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Panahon" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

---

### 5. Crear íconos placeholder

Crear dos íconos simples en `/public/icons/`:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px

Diseño del ícono: fondo naranja `#F97316`, letra "P" blanca centrada en tipografía bold.
Si no es posible generar imágenes PNG, crear un SVG y referenciarlo en el manifest.

---

## COMPORTAMIENTO ESPERADO DESPUÉS DE LA IMPLEMENTACIÓN

**En Android (Chrome):**
1. El empleado abre el link de fichaje por primera vez
2. Chrome muestra un banner "Agregar a pantalla de inicio"
3. El empleado toca el banner → se instala como app
4. Desde ese momento, abre Panahon desde el ícono en la pantalla de inicio
5. Carga instantáneo, sin barra de navegador, como una app nativa

**En iOS (Safari):**
1. El empleado abre el link en Safari
2. Toca el botón de compartir → "Agregar a pantalla de inicio"
3. Mismo resultado que Android

**Primer uso después de instalar:**
- La app recuerda el link con el `qr_token` si se instaló desde esa URL
- El empleado no necesita escanear el QR de nuevo

---

## BANNER DE INSTALACIÓN (opcional pero recomendado)

Agregar un banner de instalación dentro de la pantalla de fichaje para guiar
a los empleados que todavía no instalaron la PWA:

```jsx
// Mostrar solo si la app no está instalada y el browser soporta PWA
const [showInstallBanner, setShowInstallBanner] = useState(false)
const [deferredPrompt, setDeferredPrompt] = useState(null)

useEffect(() => {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    setDeferredPrompt(e)
    setShowInstallBanner(true)
  })
}, [])

async function handleInstall() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    setShowInstallBanner(false)
  }
}
```

**Diseño del banner:**
```
┌─────────────────────────────────────┐
│ 📲 Instalá Panahon en tu celular    │
│ Accedé más rápido sin el QR         │
│ [Instalar ahora]      [Ahora no]    │
└─────────────────────────────────────┘
```

- Fondo blanco, borde naranja sutil
- Aparece debajo del logo, arriba de la lista de empleados
- Se cierra al tocar "Ahora no" y no vuelve a aparecer en esa sesión
- Solo aparece en Android/Chrome (en iOS no está disponible el evento)

---

## LO QUE NO HAY QUE TOCAR

- La lógica de fichaje (entrada/salida)
- La conexión a Supabase
- El dashboard admin
- Las pantallas de confirmación y error
- Ninguna otra ruta de la app