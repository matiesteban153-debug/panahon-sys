# PROMPT – ELIMINAR REGISTRO CON SOFT DELETE E HISTORIAL
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Agregar la funcionalidad de eliminar registros de fichaje en la sección de Registros.
La eliminación es un **soft delete** — el registro no se borra físicamente de la base de datos,
se marca como eliminado para mantener el historial y la trazabilidad.

Solo el admin puede eliminar registros.
El admin debe ingresar un motivo obligatorio antes de confirmar la eliminación.
Los registros eliminados no aparecen en la vista normal ni en los reportes,
pero son visibles en una vista de historial separada.

**No modificar:** fichaje, empleados, reportes, dashboard ni ninguna otra pantalla.

---

## PASO 1 — Cambios en base de datos

Antes de implementar el frontend, ejecutar este SQL en Supabase:

```sql
ALTER TABLE registros
ADD COLUMN IF NOT EXISTS eliminado        boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS eliminado_at     timestamptz,
ADD COLUMN IF NOT EXISTS eliminado_por    uuid REFERENCES perfiles_admin(id),
ADD COLUMN IF NOT EXISTS motivo_eliminacion text;
```

---

## PASO 2 — Actualizar query de registros

En todas las queries que leen registros, agregar el filtro para excluir eliminados:

```js
// Agregar siempre este filtro en RegistrosPage y ReportesPage
.eq('eliminado', false)
```

---

## PASO 3 — Botón de eliminar en la tabla de registros

En cada fila de la tabla de registros, agregar un ícono de eliminar junto al de editar:

```
| Empleado | Fecha | Entrada | Salida | Horas | Estado | Acciones |
|----------|-------|---------|--------|-------|--------|----------|
| María G. | 01/08 | 18:00   | 02:00  | 8 hs  | ✓      | ✏️  🗑️  |
```

**Diseño del ícono:**
- Ícono de papelera 🗑️ en gris `#9CA3AF`
- Al hacer hover: rojo suave `#FEE2E2` de fondo, ícono rojo `#EF4444`
- Tooltip: "Eliminar registro"

---

## PASO 4 — Modal de confirmación de eliminación

Al tocar el ícono de eliminar, mostrar un modal de confirmación:

```
┌─────────────────────────────────────────┐
│ 🗑️ Eliminar registro                    │
│                                         │
│ Empleado: María González                │
│ Fecha: 01/08/2026                       │
│ Horario: 18:00 → 02:00 (8 hs)          │
│                                         │
│ ⚠️ Este registro no aparecerá más en   │
│ los reportes ni en la vista de          │
│ registros. Quedará en el historial.     │
│                                         │
│ Motivo de eliminación *                 │
│ ┌─────────────────────────────────┐    │
│ │ Ej: El empleado fichó por error │    │
│ └─────────────────────────────────┘    │
│                                         │
│ [Cancelar]        [Eliminar registro]   │
│                   (rojo, deshabilitado  │
│                    hasta que haya texto)│
└─────────────────────────────────────────┘
```

**Comportamiento:**
- El campo de motivo es obligatorio — mínimo 10 caracteres
- El botón "Eliminar registro" está deshabilitado hasta que el motivo tenga texto
- Al confirmar, el botón muestra spinner mientras procesa
- Si hay error, mostrar mensaje inline sin cerrar el modal

---

## PASO 5 — Lógica de eliminación

```js
async function eliminarRegistro(registroId, motivo) {
  const { data: perfil } = await supabase
    .from('perfiles_admin')
    .select('id')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('registros')
    .update({
      eliminado: true,
      eliminado_at: new Date().toISOString(),
      eliminado_por: perfil.id,
      motivo_eliminacion: motivo
    })
    .eq('id', registroId)

  if (error) {
    // Mostrar error amigable usando getFriendlyError()
    return { success: false }
  }

  return { success: true }
}
```

**Después de eliminar exitosamente:**
- Cerrar el modal
- Remover la fila de la tabla con una animación suave (fade out)
- Mostrar toast verde: "Registro eliminado correctamente"
- Actualizar los totales del día si el encabezado los muestra

---

## PASO 6 — Vista de historial de eliminados

Agregar un toggle o filtro en la pantalla de Registros:

```
[ Registros activos ]  [ Historial de eliminados ]
```

**Cuando se selecciona "Historial de eliminados":**

La tabla muestra los registros eliminados con estas columnas:
- Empleado
- Fecha
- Horario original
- Horas
- Eliminado el (fecha y hora)
- Motivo

**Diseño:**
- Fondo de fila: gris suave `#F9FAFB`
- Texto en gris `#6B7280` (apagado, para indicar que está inactivo)
- Sin botones de editar ni eliminar en esta vista
- Badge "Eliminado" en rojo suave junto al estado

**Query para el historial:**
```js
const { data } = await supabase
  .from('registros')
  .select(`
    id, fecha, hora_entrada, hora_salida, horas_totales,
    eliminado_at, motivo_eliminacion,
    empleados (nombre_completo)
  `)
  .eq('eliminado', true)
  .order('eliminado_at', { ascending: false })
```

---

## ESCENARIOS A CONTEMPLAR

| Escenario | Comportamiento |
|-----------|---------------|
| Admin elimina sin motivo | Botón deshabilitado, no puede confirmar |
| Admin elimina registro sospechoso | Funciona igual, el registro queda en historial con su badge ⚠️ |
| Admin elimina registro ya editado manualmente | Funciona igual |
| Admin intenta eliminar desde el historial | No hay botón de eliminar en la vista de historial |
| Error de red al eliminar | Mensaje de error inline, modal no se cierra |
| Registro eliminado aparece en reportes | No debe aparecer — la query de reportes ya filtra `eliminado = false` |
| Registro eliminado aparece en el resumen del día | No debe sumar al total de horas ni al total a pagar del día |

---

## NOTAS IMPORTANTES

- **No agregar botón de restaurar** — el historial es solo para consulta
- El campo `motivo_eliminacion` queda guardado permanentemente para auditoría
- Los registros eliminados **no deben afectar** los cálculos de horas ni sueldos
- La vista de historial debe estar disponible para el admin en cualquier momento
- Usar `getFriendlyError()` para todos los errores de esta funcionalidad

---

## LO QUE NO HAY QUE TOCAR

- La lógica de fichaje
- La pantalla de empleados
- Los reportes (solo agregar el filtro `eliminado = false` donde corresponda)
- El dashboard
- El trigger de cálculo de sueldos