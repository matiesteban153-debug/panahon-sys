# 🚀 PWA - Guía Rápida

## ⚡ Paso único pendiente

**Generar los iconos PNG:**

1. Abre `/generate-pwa-icons.html` en tu navegador
2. Clic en "🎨 Generar Iconos"
3. Descarga y guarda:
   - `icon-192.png` → `/public/icons/icon-192.png`
   - `icon-512.png` → `/public/icons/icon-512.png`

## ✅ Ya implementado

- ✅ Service Worker configurado (solo para `/fichaje`)
- ✅ Manifest PWA listo
- ✅ Banner de instalación en app de fichaje
- ✅ Meta tags PWA en HTML
- ✅ Cache optimizado (nunca cachea Supabase)
- ✅ Actualización automática silenciosa

## 📱 Cómo se usa

**Para empleados:**
1. Abren el link de fichaje en su celular
2. Ven banner: "📲 Instalá Panahon en tu celular"
3. Tocan "Instalar ahora"
4. App se instala en pantalla de inicio
5. Desde ese momento, abren la app sin escanear QR

**Para administradores:**
- El dashboard `/admin` muestra el estado de instalación PWA
- Componente `PWAStatus` con información y botón de instalación

## 🎯 Características

- **Offline-ready**: Carga rápida incluso sin internet
- **Instalable**: Como una app nativa en Android/iOS
- **Sin QR repetido**: El token se guarda en el `start_url`
- **Auto-actualización**: Nueva versión se instala sola

## 🔧 Detalles técnicos

```
Scope: /fichaje (solo la app de fichaje es PWA)
Theme: #F97316 (naranja Panahon)
Display: standalone (pantalla completa, sin browser)
Orientation: portrait (vertical)
Cache: Network-first para APIs, cache-first para assets
```

## 📚 Documentación completa

Ver `/PWA_README.md` para detalles técnicos completos.
