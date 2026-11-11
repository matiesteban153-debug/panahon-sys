# Implementación PWA - Panahon

## ✅ Archivos implementados

La implementación de PWA para la app de fichaje está completa con los siguientes archivos:

### Archivos esenciales
- ✅ `/public/manifest.json` - Configuración de la PWA enfocada en `/fichaje`
- ✅ `/public/sw.js` - Service Worker con caché optimizada (nunca cachea Supabase)
- ✅ `/index.html` - Meta tags PWA y registro del Service Worker (solo para `/fichaje`)
- ✅ `/src/app/components/fichaje/PWAInstallBanner.tsx` - Banner de instalación
- ✅ `/src/app/components/fichaje/SelectionScreen.tsx` - Integrado con PWA banner
- ✅ `/src/app/hooks/usePWA.ts` - Hook para detectar instalación
- ✅ `/src/app/components/admin/PWAStatus.tsx` - Status de PWA en admin
- ✅ `/generate-pwa-icons.html` - Generador de iconos

## 📱 Paso final: Generar iconos PNG

**IMPORTANTE**: Debes generar los iconos PNG manualmente:

1. Abre el archivo `/generate-pwa-icons.html` en tu navegador
2. Haz clic en el botón "🎨 Generar Iconos"
3. Descarga los dos iconos:
   - `icon-192.png` → guardar en `/public/icons/icon-192.png`
   - `icon-512.png` → guardar en `/public/icons/icon-512.png`

## 🎯 Comportamiento esperado

### En Android (Chrome)
1. Usuario abre el link de fichaje `/fichaje?empresa=TOKEN`
2. Chrome muestra banner "Agregar a pantalla de inicio" (nuestro banner personalizado)
3. Usuario toca el banner → se instala como app
4. Desde ese momento, abre Panahon desde el ícono en la pantalla de inicio
5. Carga instantáneo, sin barra de navegador, como una app nativa

### En iOS (Safari)
1. Usuario abre el link en Safari
2. Toca el botón de compartir → "Agregar a pantalla de inicio"
3. Mismo resultado que Android

### Primer uso después de instalar
- La app recuerda el link con el `qr_token` (a través del `start_url`)
- El empleado no necesita escanear el QR de nuevo si abre la app directamente

## 🔒 Seguridad

- ✅ Service Worker **nunca cachea** llamadas a Supabase
- ✅ Solo cachea assets estáticos (HTML, CSS, JS, iconos)
- ✅ Service Worker se registra **solo en `/fichaje`**, no en admin
- ✅ Cache first para assets, network first para datos

## 🚀 Beneficios

1. **Instalación rápida**: Banner personalizado en la app de fichaje
2. **Funcionamiento offline**: Assets cacheados para carga rápida
3. **Experiencia nativa**: Sin barra de navegador, pantalla completa
4. **Actualización automática**: Nueva versión se instala silenciosamente

## 📝 Notas técnicas

- El `manifest.json` tiene `start_url: "/fichaje"` y `scope: "/fichaje"`
- Esto significa que la PWA solo funciona en la ruta `/fichaje`
- El dashboard admin `/admin` sigue siendo web normal
- El Service Worker se desinstala automáticamente si el usuario sale de `/fichaje`

## 🧪 Cómo probar

1. Genera los iconos PNG (paso arriba)
2. Despliega la app
3. Abre `/fichaje?empresa=TOKEN` en Chrome Android o Safari iOS
4. Espera unos segundos → aparece el banner de instalación
5. Toca "Instalar ahora"
6. La app se instala en la pantalla de inicio
7. Abre la app desde el ícono → funciona offline y carga rápido

## 🎨 Personalización

Si necesitas cambiar el color o el diseño:

- **Color principal**: `#F97316` (naranja) en `manifest.json` y `theme-color`
- **Fondo**: `#ffffff` (blanco) en `manifest.json`
- **Logo**: Edita `/src/imports/logo-panahon.svg` y regenera los iconos

## ⚠️ Importante

- **NO tocar** el código de fichaje existente (entrada/salida)
- **NO tocar** la conexión a Supabase
- **NO modificar** el dashboard admin
- Solo se agregaron funcionalidades PWA, no se cambió ninguna lógica existente

---

**Fecha de implementación**: Abril 2026
**Versión**: v1.0
