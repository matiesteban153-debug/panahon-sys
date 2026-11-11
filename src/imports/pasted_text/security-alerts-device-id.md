# PROMPT – FIGMA MAKE: ALERTAS DE SEGURIDAD + DEVICE_ID
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Transformar la validación por dispositivo de un bloqueo a un sistema
de monitoreo. El fichaje nunca se interrumpe — los eventos inusuales
se registran y el admin los ve en un nuevo panel de Alertas.

**Cambios a realizar:**
1. Actualizar el fichaje para enviar `device_id` sin bloquear
2. Agregar nueva sección "Alertas" en el dashboard
3. Agregar opción de resetear device_id en el perfil de empleado

**No modificar:** registros, reportes, empleados (excepto lo indicado), fichaje visual.

---

## CAMBIO 1 — Generar y enviar `device_id` en el fichaje

El `device_id` es un identificador estable del navegador generado con
`localStorage` la primera vez y reutilizado en las siguientes.

```js
// utils/deviceId.ts
export function getDeviceId(): string {
  const KEY = 'panahon_device_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
```

**Actualizar las llamadas RPC de fichaje para incluir el device_id:**

```js
import { getDeviceId } from '@/utils/deviceId'

// Al fichar entrada
const { data } = await supabase.rpc('fichar_entrada', {
  p_qr_token:    qrToken,
  p_empleado_id: empleadoId,
  p_pin:         pin || null,
  p_latitud:     latitud,
  p_longitud:    longitud,
  p_device_info: navigator.userAgent,
  p_device_id:   getDeviceId()         // ← nuevo parámetro
})

// Al fichar salida (igual)
const { data } = await supabase.rpc('fichar_salida', {
  p_qr_token:    qrToken,
  p_empleado_id: empleadoId,
  p_pin:         pin || null,
  p_latitud:     latitud,
  p_longitud:    longitud,
  p_device_info: navigator.userAgent,
  p_device_id:   getDeviceId()         // ← nuevo parámetro
})
```

**Importante:** si `data.dispositivo_conocido === false`, el fichaje
igual fue exitoso. No mostrar ningún error al empleado. El sistema
registró el evento en background para que el admin lo vea.

---

## CAMBIO 2 — Nueva sección "Alertas" en el sidebar

Agregar al sidebar del dashboard admin:
- Ícono: 🔔 o shield
- Label: "Alertas"
- Badge con el número de alertas sin revisar (solo si hay alguna)
- Ruta: `/admin/alertas`

**Query para el badge del sidebar:**
```js
const { count } = await supabase
  .from('eventos_seguridad')
  .select('id', { count: 'exact' })
  .eq('revisado', false)
// Si count > 0, mostrar badge naranja con el número
```

---

## CAMBIO 3 — Pantalla de Alertas (`/admin/alertas`)

### Header
```
Alertas de seguridad

[ Todos ▾ ]  [ Sin revisar ▾ ]          Marcar todos como revisados
```

Filtro por tipo:
- Todos
- Dispositivo no reconocido
- Registros sospechosos

Filtro por estado:
- Sin revisar
- Revisados
- Todos

### Tabla de alertas

Columnas: Empleado · Tipo · Fecha · Dispositivo · Ubicación · Estado · Acciones

**Diseño de cada fila:**

```
┌──────────────────────────────────────────────────────────────┐
│ [Avatar] Juan Pérez    📱 Dispositivo no reconocido          │
│          04/06/2026 18:42  ·  Entrada                       │
│          Ubicación: válida                                    │
│                                    [Revisar]  [Ver registro] │
└──────────────────────────────────────────────────────────────┘
```

**Colores por tipo de evento:**
- `dispositivo_no_reconocido` → fondo amarillo suave `#FFFBEB`, badge `#F59E0B`
- `registro_sospechoso` → fondo naranja suave `#FFF4EC`, badge `#F97316`
- `ubicacion_fuera_de_rango` → fondo rojo suave `#FEF2F2`, badge `#EF4444`

**Query para cargar alertas:**
```js
const { data } = await supabase
  .from('eventos_seguridad')
  .select(`
    id, tipo_evento, tipo_fichaje, created_at,
    device_id_recibido, device_id_registrado,
    latitud, longitud, descripcion, revisado,
    empleados (nombre_completo)
  `)
  .order('created_at', { ascending: false })
  .limit(50)
```

### Acción "Revisar"

Al tocar "Revisar" en una alerta:

```js
const { data } = await supabase.rpc('marcar_evento_revisado', {
  p_evento_id: eventoId
})
// Si success: cambiar el estado de la fila a "Revisado" y actualizar el badge del sidebar
```

### Acción "Ver registro"

Navega a `/admin/registros` con el empleado y la fecha pre-filtrados.

### Estado vacío

Si no hay alertas sin revisar:
```
✓ Todo en orden
No hay alertas pendientes de revisión.
```
Fondo verde suave, ícono de check.

---

## CAMBIO 4 — Resetear device_id desde el perfil del empleado

En el modal de editar empleado, agregar sección al final:

```
── Dispositivo registrado ──────────────────
Dispositivo principal: Registrado ✓
o
Dispositivo principal: No registrado

[Resetear dispositivo]  ← botón outline gris

Al resetear, el próximo fichaje del empleado registrará
su dispositivo como el nuevo oficial.
```

**Al tocar "Resetear dispositivo":**
- Mostrar confirmación: "¿Seguro? El próximo fichaje de este empleado registrará su dispositivo automáticamente."
- Si confirma:

```js
const { data } = await supabase.rpc('resetear_device_id', {
  p_empleado_id: empleadoId
})
// Toast: "Dispositivo reseteado. El próximo fichaje registrará el nuevo dispositivo."
```

---

## CAMBIO 5 — Alerta en el dashboard principal

Si hay eventos sin revisar en los últimos 7 días, mostrar en el panel
de alertas del dashboard existente:

```
🔔 X alertas de seguridad sin revisar  →  Ver alertas
```

Badge naranja, link directo a `/admin/alertas`.

---

## LO QUE NO HAY QUE TOCAR

- La pantalla de fichaje visual (el empleado no ve nada diferente)
- Los registros, reportes y exportaciones
- La lógica de registros sospechosos existente
- La autenticación