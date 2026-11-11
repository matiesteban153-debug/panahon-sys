# PROMPT – FIX VISUAL BUG FICHAJE CROSS-DAY
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Se detectó un bug: cuando un empleado ficha entrada un día y salida al día siguiente,
el sistema registra horas incorrectas. Ya se actualizó Supabase para detectar este caso
y marcar esos registros con `sospechoso = true` y un `motivo_sospecha` descriptivo.

Hay que hacer dos cambios en el frontend:
1. Mostrar los registros sospechosos con alerta visual en la tabla de Registros
2. Actualizar el modal de edición para permitir dividir el registro en dos

**No modificar ninguna otra pantalla ni componente.**

---

## CAMBIO 1 — Tabla de Registros: mostrar registros sospechosos

En la tabla de registros (`/admin/registros`), los registros con `sospechoso = true`
deben destacarse visualmente.

**Fila con `sospechoso = true`:**
- Fondo de la fila: amarillo muy suave (`#FFFBEB`)
- Badge nuevo junto al badge de estado: "⚠️ Revisar" con fondo `#FEF3C7` y texto `#92400E`
- Al hacer hover sobre el badge, mostrar tooltip con el `motivo_sospecha`:
  ej: "Salida registrada el 15/02/2025 pero la entrada fue el 14/02/2025"

**La query de Supabase debe incluir los nuevos campos:**
```js
const { data } = await supabase
  .from('registros')
  .select(`
    id,
    fecha,
    hora_entrada,
    hora_salida,
    horas_totales,
    editado_manual,
    sospechoso,
    motivo_sospecha,
    empleados (nombre_completo)
  `)
  .gte('fecha', desde)
  .lte('fecha', hasta)
  .order('fecha', { ascending: false })
```

---

## CAMBIO 2 — Modal de edición: opción para dividir en dos registros

El modal de edición actual permite editar `hora_entrada` y `hora_salida`.
Cuando el registro tiene `sospechoso = true`, agregar una sección adicional al modal.

**Estructura del modal actualizado para registros sospechosos:**

```
┌─────────────────────────────────────┐
│ Editar registro                      │
│                                      │
│ Empleado: María González (solo lec.) │
│ Fecha: 14/02/2025 (solo lectura)     │
│                                      │
│ ⚠️ Este registro puede tener horas  │
│ incorrectas. La salida fue registrada│
│ al día siguiente.                    │
│                                      │
│ ── Edición simple ──────────────────│
│ Hora entrada: [08:00]                │
│ Hora salida:  [17:00]                │
│                                      │
│ ── O dividir en dos registros ──────│
│ Día 1 – 14/02/2025                  │
│   Hora entrada: [08:00] (pre-cargado)│
│   Hora salida:  [__:__]              │
│                                      │
│ Día 2 – [  fecha  ]                 │
│   Hora entrada: [__:__]              │
│   Hora salida:  [__:__]              │
│                                      │
│ [Cancelar] [Guardar simple] [Dividir]│
└─────────────────────────────────────┘
```

**Comportamiento:**
- La sección "dividir" aparece solo si `sospechoso = true`
- Los campos del Día 1 pre-cargan con `hora_entrada` del registro original
- La fecha del Día 2 pre-carga con el día siguiente a la fecha del registro
- Todos los campos de hora son inputs tipo `time` (HH:MM)
- El botón **"Guardar simple"** guarda solo `hora_entrada` y `hora_salida` editadas (comportamiento actual)
- El botón **"Dividir"** llama a la función RPC `dividir_registro`

**Llamada RPC para dividir:**
```js
const { data } = await supabase.rpc('dividir_registro', {
  p_registro_id: registroId,
  p_hora_salida_1: `${fechaDia1}T${horaSalidaDia1}:00+00:00`,
  p_fecha_2: fechaDia2,                                          // formato YYYY-MM-DD
  p_hora_entrada_2: `${fechaDia2}T${horaEntradaDia2}:00+00:00`,
  p_hora_salida_2: `${fechaDia2}T${horaSalidaDia2}:00+00:00`
})

if (data.success) {
  // Cerrar modal y refrescar la tabla de registros
  // Mostrar toast: "Registro dividido correctamente"
} else {
  // Mostrar error inline: data.error
}
```

**Validaciones antes de llamar a dividir:**
- Hora salida Día 1 es requerida
- Fecha Día 2 es requerida y debe ser posterior a fecha Día 1
- Hora entrada Día 2 es requerida
- Hora salida Día 2 es requerida
- Hora salida Día 2 debe ser posterior a hora entrada Día 2
- Si alguna falla → mostrar error inline, no ejecutar el RPC

---

## CAMBIO 3 — Dashboard: alerta de registros sospechosos

En el dashboard principal, si hay registros con `sospechoso = true` en el mes actual,
mostrar una alerta en el panel de alertas existente:

```js
// Query para contar registros sospechosos del mes
const { count } = await supabase
  .from('registros')
  .select('id', { count: 'exact' })
  .eq('sospechoso', true)
  .gte('fecha', inicioMes)
  .lte('fecha', finMes)
```

Mensaje de alerta:
- "⚠️ X registros tienen horarios inconsistentes este mes" → link "Revisar" → va a `/admin/registros` con filtro `sospechoso=true` pre-aplicado

---

## LO QUE NO HAY QUE TOCAR

- La lógica de fichaje en la app de empleados
- El filtro de fechas de la pantalla de Registros
- La pantalla de Reportes
- Cualquier otra pantalla del dashboard
- La función `fichar_entrada`